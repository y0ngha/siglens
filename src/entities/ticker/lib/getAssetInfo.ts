import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import { fetchKrEquityQuoteName } from './krEquityQuoteName';
import { krExchangeOf } from './krExchange';
import { CURATED_KOREAN_NAMES } from '@/shared/config/popular-tickers';
import { DrizzleAssetTranslationRepository } from '../api';
import { getCryptoAsset } from './cryptoAssetStore';
import { fetchCryptoQuoteName } from './cryptoQuoteName';
import { fmpCryptoMembership } from './fmpCryptoMembership';
import type {
    AssetTranslationRecord,
    AssetTranslationRepository,
} from '@/shared/db/types';
import {
    ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN,
    buildAssetInfoProvisionalCacheKey,
} from './cacheKeys';
import { tryGetDatabaseClient } from '@/shared/db/client';
import {
    filterUsExchanges,
    findExactUsMatch,
    searchBySymbol,
} from './fmpTickerApi';
import { translateCompanyNames } from './koreanTranslator';
import {
    getKoreanNames,
    lookupTickerDisplayNames,
    setKoreanTickers,
    type TickerDisplayName,
} from './koreanNameStore';
import { normalizeCompanyName } from './normalizeCompanyName';
import { CANONICAL_KOREAN_NAMES } from '@/shared/config/canonical-korean-names';
import { fireAndForget } from '@/shared/lib/backgroundTask';
import {
    createSingleFlight,
    __resetSingleFlightForTests,
} from '@/shared/lib/singleFlight';
import { createCacheProvider, type CacheProvider } from '@y0ngha/siglens-core';
import type { AssetInfo, KoreanTickerEntry } from '@/shared/lib/types';

function tryGetRepository(): AssetTranslationRepository | null {
    const client = tryGetDatabaseClient();
    if (!client) return null;
    return new DrizzleAssetTranslationRepository(client.db);
}

function recordToAssetInfo(record: AssetTranslationRecord): AssetInfo {
    return {
        symbol: record.symbol,
        name: record.name,
        koreanName: record.koreanName,
        ...(record.fmpSymbol !== record.symbol && {
            fmpSymbol: record.fmpSymbol,
        }),
    };
}

/**
 * 정본 한글명이 있으면 덮는다. **`getAssetInfo`의 모든 반환 경로가 이걸 거친다.**
 *
 * `asset_translations`의 한글명은 LLM이 종목 방문 시 lazy하게 채운 것이라 표기가
 * 흔들린다 — 2026-08-24 실측에서 `LAES`가 홈/대시보드/DB에서 각각 세알시큐리티/
 * SEALSQ/씰스큐로 세 갈래였다. 사람이 고른 표기가 있으면 그쪽이 이겨야 같은
 * 종목이 화면마다 다른 이름으로 보이지 않는다(`CANONICAL_KOREAN_NAMES` JSDoc).
 *
 * ⚠️ **DB 읽기 지점이 아니라 함수 출구에 둔다.** 반환 경로가 여럿(크립토 DB·
 * `asset_translations` DB·Redis 임시 항목·야후·FMP)이라 한 지점에만 덮으면 나머지
 * 경로로 나간 옛 이름이 그대로 남는다. 과거에는 Redis 캐시가 먼저 답해 즉시
 * 반환하는 경로(`if (cached) return cached`)가 있었고, DB 경로에만 덮었다가 로컬
 * 실증에서 제목이 하나도 안 바뀌는 것을 확인했다. 지금은 Redis가 1년 사본을 들지
 * 않지만, 출구에 두면 어느 경로로 왔든 같은 이름이 나가는 불변식이 경로가 늘어도
 * 유지된다.
 *
 * Redis에 쓰는 임시 항목(12시간)은 원본 그대로 둔다 — 캐시가 파생값을 들고 있으면
 * 정본 맵과 어긋날 수 있기 때문이다. 덕분에 맵을 고쳐도 무효화가 필요 없다.
 *
 * ⚠️ **그렇다고 배포 즉시 전 화면에 반영되는 건 아니다.** `getAssetInfoStatic`이
 * 결과를 `unstable_cache`(24h, S3 cache-handler라 배포를 넘어 살아남는다)로 다시
 * 감싸므로, 이미 방문된 `[symbol]` 라우트는 TTL이 끝나거나
 * `revalidateTag('symbol:<TICKER>')`를 부르기 전까지 옛 이름을 서빙한다.
 */
function withCanonicalKoreanName(info: AssetInfo | null): AssetInfo | null {
    if (info === null) return info;
    const canonical = CANONICAL_KOREAN_NAMES.get(info.symbol);
    return canonical === undefined ? info : { ...info, koreanName: canonical };
}

function setCacheBestEffort(
    cache: CacheProvider | null,
    cacheKey: string,
    info: AssetInfo,
    ttlSeconds: number
): void {
    if (!cache) return;
    cache
        .set(cacheKey, info, ttlSeconds)
        .catch(e => console.warn('[getAssetInfo] cache write failed', e));
}

/**
 * Next.js가 네비게이션마다 진행 중 요청을 취소할 때 나는 AbortError는 예상된
 * 동작이라 로그를 남기지 않는다. DB 드라이버(postgres-js)는 TCP라 fetch의
 * AbortSignal을 거치지 않으므로 `cause.sourceError`로 한 겹 감싸 던지던 옛 Neon HTTP
 * 형태는 더 이상 없다 — 직접 던져진 AbortError만 본다.
 */
function isAbortError(e: unknown): boolean {
    return e instanceof Error && e.name === 'AbortError';
}

async function readFromDatabase(symbol: string): Promise<AssetInfo | null> {
    const repository = tryGetRepository();
    if (!repository) return null;

    try {
        const record = await repository.findBySymbol(symbol);
        return record ? recordToAssetInfo(record) : null;
    } catch (e) {
        if (isAbortError(e)) return null;
        console.warn('[getAssetInfo] DB read failed', e);
        return null;
    }
}

/**
 * 번역 결과를 `asset_translations`에 upsert하고, DB에 실제로 썼는지 돌려준다.
 *
 * Redis에는 쓰지 않는다 — 읽기 경로가 DB를 먼저 보므로(`resolveAssetInfo` JSDoc)
 * 1년짜리 Redis 사본은 DB와 중복이고 명령 수만 늘린다. DB에 못 쓴 경우의 보완은
 * 호출부(`persistOrCacheProvisional`)가 `false`를 보고 처리한다.
 *
 * @returns DB 클라이언트가 없거나 upsert가 실패하면 `false`.
 */
async function persistTranslation(
    info: Pick<AssetInfo, 'symbol' | 'name'> & { koreanName: string },
    fmpSymbol: string
): Promise<boolean> {
    const { symbol, name, koreanName } = info;
    const repository = tryGetRepository();
    if (!repository) return false;

    try {
        await repository.upsert({ symbol, name, koreanName, fmpSymbol });
        return true;
    } catch (e) {
        console.warn('[getAssetInfo] DB upsert failed', e);
        return false;
    }
}

/**
 * 번역을 DB에 저장하되, DB에 쓰지 못했으면 한글명을 담은 12시간 임시 항목을 Redis에 쓴다.
 *
 * DB가 저하된 동안(클라이언트 없음·upsert 실패·repository 생성 실패)에는 한글명이
 * 어디에도 남지 않아, `unstable_cache`로 감싸이지 않은 호출자(`getAssetLabelsAction`,
 * `savePortfolioHoldingAction` 등)가 호출마다 FMP/yahoo 조회와 번역을 반복한다.
 * 임시 항목이 그 반복을 막는다. DB 저장이 성공하면 읽기 경로가 DB에서 바로 잡으므로
 * Redis에는 쓰지 않는다.
 *
 * repository 생성이 던져도(`persistTranslation` reject) 임시 항목은 쓰고 그 거절은
 * 그대로 전파한다 — 호출부의 `.catch`가 warn으로 삼킨다.
 */
async function persistOrCacheProvisional(
    info: AssetInfo & { koreanName: string },
    fmpSymbol: string,
    cache: CacheProvider | null
): Promise<void> {
    const outcome = await persistTranslation(info, fmpSymbol).then(
        persisted => ({ persisted, rejected: false as const }),
        (error: unknown) => ({
            persisted: false,
            rejected: true as const,
            error,
        })
    );
    if (!outcome.persisted) {
        setCacheBestEffort(
            cache,
            buildAssetInfoProvisionalCacheKey(info.symbol),
            info,
            ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN
        );
    }
    if (outcome.rejected) throw outcome.error;
}

/** Subset of an FMP search result needed when persisting a translation. */
interface AssetInfoMatch {
    symbol: string;
    name: string;
    exchange: string;
    exchangeFullName: string;
}

/** Single-flight registry for fire-and-forget translate-and-persist work; collapses concurrent calls for the same symbol into one translation request. */
const translationSingleFlight = createSingleFlight<void>();

function translateAndPersist(
    symbol: string,
    match: AssetInfoMatch,
    cache: CacheProvider | null,
    marketProfile?: MarketProfileId
): Promise<void> {
    return translationSingleFlight.run(symbol, async () => {
        const translated = await translateCompanyNames([
            { symbol, name: match.name },
        ]);
        const koreanName = translated[symbol];
        if (!koreanName) return;

        // Mapping intent (do not invert):
        // - korean_tickers.symbol holds the canonical (cashtag) symbol, e.g. "AAPL"
        // - asset_translations.symbol holds the canonical symbol (PK)
        // - asset_translations.fmp_symbol holds the FMP-side symbol, e.g. "AAPL.MX"
        // For US equities canonical === fmpSymbol; they diverge for indices etc.
        const entry: KoreanTickerEntry = {
            symbol,
            name: match.name,
            koreanName,
            exchange: match.exchange,
            exchangeFullName: match.exchangeFullName,
        };
        await setKoreanTickers([entry]);
        // DB 저장이 실패하면 이 객체가 그대로 Redis 임시 항목이 되어 읽기 경로가 돌려준다 —
        // 최초 응답과 같은 형태(`fmpSymbol`·`marketProfile`)여야 하는 이유다.
        const info: AssetInfo & { koreanName: string } = {
            symbol,
            name: match.name,
            koreanName,
            ...(match.symbol !== symbol && { fmpSymbol: match.symbol }),
            ...(marketProfile && { marketProfile }),
        };
        await persistOrCacheProvisional(info, match.symbol, cache);
    });
}

/**
 * 한국 상장 종목의 AssetInfo를 yahoo quote로 해석한다.
 *
 * 미국 주식 경로(FMP `searchBySymbol` → `findExactUsMatch` → 번역)와 같은 형태를
 * 유지한다 — 조회 소스만 yahoo다. 덕분에 한글명은 신규 코드 없이 기존
 * `translateCompanyNames` 경로로 채워지고, 그 부산물로 `korean_tickers`에
 * 행이 생겨 **한글 검색까지 자동으로 동작한다**(`searchByKoreanName`). 별도의
 * 한국 종목 마스터 테이블이 필요하지 않은 이유다.
 *
 * quote가 없으면 `null`을 반환해 호출부의 `notFound()`가 동작한다 — 형상만 맞는
 * 가짜 티커(`999999.KS`)가 빈 페이지로 렌더되지 않게 하는 지점이다.
 */
async function resolveKrEquityAssetInfo(
    upper: string,
    cache: CacheProvider | null
): Promise<AssetInfo | null> {
    const name = await fetchKrEquityQuoteName(upper);
    if (name === null) return null;

    const koreanNames = await getKoreanNames([upper]);
    // 큐레이션 카탈로그를 fallback으로 둔다 — ISR이 첫 렌더를 캐시에 굳히므로, lazy 번역이
    // 끝나기를 기다리면 대표 종목의 SEO 제목이 revalidate 주기 내내 영문으로 남는다.
    const koreanName = koreanNames[upper] ?? CURATED_KOREAN_NAMES.get(upper);

    const info: AssetInfo = {
        symbol: upper,
        name,
        marketProfile: 'kr-equity',
        ...(koreanName && { koreanName }),
    };

    if (koreanName) {
        fireAndForget(
            persistOrCacheProvisional(
                { ...info, koreanName },
                upper,
                cache
            ).catch(e => console.warn('[getAssetInfo] kr persist failed', e))
        );
        return info;
    }

    const exchange = krExchangeOf(upper);
    fireAndForget(
        translateAndPersist(
            upper,
            {
                symbol: upper,
                name,
                exchange: exchange.code,
                exchangeFullName: exchange.fullName,
            },
            cache,
            'kr-equity'
        ).catch(e =>
            console.warn('[getAssetInfo] kr background translation failed', e)
        )
    );

    // 번역이 끝나 `asset_translations`에 들어가면 읽기 경로가 DB에서 먼저 잡으므로
    // 이 임시 항목은 12시간 동안 영문 이름에 머물게 하지 않는다. 번역이 진행되는
    // 동안 같은 심볼의 yahoo 재조회만 막는 용도다.
    setCacheBestEffort(
        cache,
        buildAssetInfoProvisionalCacheKey(upper),
        info,
        ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN
    );

    return info;
}

/**
 * `korean_tickers`에 저장된 한글명을 FMP 경로에서 재사용해도 되는지 판정한다.
 *
 * 티커 재할당·사명 변경으로 심볼이 다른 회사로 넘어가면 저장된 영문명과 FMP가 지금 돌려준
 * 영문명이 달라진다. 그대로 재사용하면 옛 회사의 한글명이 굳으므로, 정규화한 두 이름이
 * 다르면 재사용하지 않고 호출부가 `translateAndPersist`로 보내게 한다. 이미 FMP 이름을
 * 손에 쥔 경로라 추가 호출이 없다.
 *
 * 정본 심볼은 사람이 고른 이름이 이기므로 항상 재사용한다(`getTickerDisplayNames`가 이미
 * 정본을 입혀 돌려준다). 저장된 영문명이 없으면(행 없이 정본만 나온 경우) 비교 대상이
 * 없어 그대로 쓴다.
 */
function reusableKoreanName(
    symbol: string,
    fmpName: string,
    stored: TickerDisplayName | undefined
): string | undefined {
    if (!stored?.koreanName) return undefined;
    if (CANONICAL_KOREAN_NAMES.has(symbol) || stored.name === null) {
        return stored.koreanName;
    }
    return normalizeCompanyName(stored.name) === normalizeCompanyName(fmpName)
        ? stored.koreanName
        : undefined;
}

/** Test helper — clears the in-flight registry between cases. */
export function _resetInFlightTranslationsForTest(): void {
    __resetSingleFlightForTests(translationSingleFlight);
}

/**
 * Resolve canonical asset information for a single ticker symbol.
 *
 * 해석은 `resolveAssetInfo`(DB → 임시 Redis 항목 → yahoo/FMP, 백그라운드 한글명 번역 포함)가
 * 하고, 이 래퍼는 마지막에 정본 한글명을 덮는다 —
 * `withCanonicalKoreanName` JSDoc에 출구에 둬야 하는 이유가 있다.
 *
 * **이 함수는 캐시하지 않는다(의도).** 요청 간 캐시도, 요청 내 `React.cache`도 없어서 부를
 * 때마다 `asset_translations`를 읽는다(그 행이 없을 때만 Redis 임시 항목·yahoo/FMP로 간다).
 * 캐시는 호출 경로가 고른다:
 *   - 페이지 렌더(ISR): `getAssetInfoStatic`(Next data cache 24h, `symbol:` 태그) 또는 그걸
 *     감싼 `getAssetInfoResilient`(요청 내 `React.cache` + degrade). 렌더 중 이 함수를 직접
 *     부르면 DB 읽기가 `unstable_cache` 밖이라 정적 생성이 동적으로 떨어진다.
 *   - 방문자 상호작용마다 도는 서버 액션·라우트(예: `getBarsAction`): 캐시된 경로
 *     (`resolveMarketProfileStatic` 등)를 쓴다. 차트 조회마다 DB를 치던 것이
 *     2026-10 서버 성능 감사 L4였다.
 *   - 그 밖의 호출부(포트폴리오 저장·라벨 조회·분석 스트림 등)는 이 함수를 그대로 쓴다 —
 *     호출 빈도가 낮거나, 24h 캐시가 막 추가된 종목을 "모름"으로 굳히면 안 되는 경로다.
 */
export async function getAssetInfo(symbol: string): Promise<AssetInfo | null> {
    return withCanonicalKoreanName(await resolveAssetInfo(symbol));
}

/**
 * 심볼 하나의 AssetInfo를 해석한다. 정본 덮어쓰기는 호출자(`getAssetInfo`)가 한다.
 *
 * 해석 순서: `crypto_assets` DB → FMP 크립토 목록 → `asset_translations` DB →
 * Redis 임시 항목(12시간) → 한국 종목(yahoo) → FMP 검색.
 *
 * ⚠️ **Redis를 맨 앞에서 읽지 않는다.** 예전에는 `asset-info:<SYM>`을 먼저 읽고
 * 번역 완료 항목을 1년 TTL로 써 두었는데, 2026-10 실측에서 Redis의 32,667개 키가
 * 전부 1년 TTL이었고 DB에는 `asset_translations` 28,499행 + `crypto_assets`
 * 4,785행이 있어 Redis는 DB의 중복 사본이었다. 그 GET이 앱 Redis 명령의 14%였고
 * Upstash는 명령 수로 과금한다. DB가 같은 AZ의 RDS(~1ms)로 옮겨 가므로 DB를 바로
 * 읽는 쪽이 더 싸고 빠르다. (수치 근거와 재측정 방법: PR #915 설명 — 키 수·TTL은 SCAN +
 * PTTL 전수 집계, 명령 비중은 운영 Upstash `MONITOR` 2분 표본을 클라이언트 IP별로 집계.)
 *
 * 크립토 검사는 `asset_translations`보다 앞에 둔다 — 분류 우선순위를 기존과 같게
 * 유지하기 위해서다. 이 순서 때문에 크립토가 아닌 모든 호출이 `fmpCryptoMembership`을
 * 먼저 지나므로, 이 순서는 FMP 크립토 목록의 인스턴스 메모리 캐시(1시간, 호출마다
 * ~170KB Redis GET 방지)에 기댄다.
 *
 * Redis에는 번역이 아직 없거나 DB에 저장하지 못한 심볼의 임시 항목(12시간, 전용 키
 * `buildAssetInfoProvisionalCacheKey`)만 남는다. 읽기가 DB 미스
 * 뒤라서, 번역이 `asset_translations`에 들어가는 즉시 한글명이 나가고 임시
 * 항목의 영문 이름이 12시간 늦게까지 남지 않는다.
 */
async function resolveAssetInfo(symbol: string): Promise<AssetInfo | null> {
    const upper = symbol.toUpperCase();
    if (!isAdmissibleSymbolShape(upper)) return null;

    const cache = createCacheProvider();
    const cacheKey = buildAssetInfoProvisionalCacheKey(upper);

    // Crypto classification is authoritative via crypto_assets membership.
    // FMP profile is empty for crypto, so name comes from DB (fallback: quote).
    const cryptoAsset = await getCryptoAsset(upper);
    if (cryptoAsset) {
        const name = cryptoAsset.name || (await fetchCryptoQuoteName(upper));
        return {
            symbol: upper,
            name,
            marketProfile: 'crypto',
            ...(cryptoAsset.koreanName
                ? { koreanName: cryptoAsset.koreanName }
                : {}),
        };
    }

    // FMP-list freshness fallback: when a new crypto is not yet seeded in
    // crypto_assets, check membership against the cached FMP cryptocurrency-list
    // (~24 h TTL). This closes the "new coin until next re-seed" gap — new coins
    // resolve as crypto within the cache window instead of 404-ing.
    // DB remains primary (koreanName/supply); FMP-list is the fallback only.
    // fmpCryptoMembership degrades to null on infra/FMP failure (never throws),
    // so this check cannot cause a 500 on ISR cold-gen.
    const fmpEntry = await fmpCryptoMembership(upper);
    if (fmpEntry) {
        const name = fmpEntry.name || (await fetchCryptoQuoteName(upper));
        // FMP-list records have no koreanName and are provisional (valid only until
        // the next crypto_assets re-seed). Redis에는 쓰지 않는다 — 목록 자체가 이미
        // 캐시되어 있어 재조회가 싸고, 따로 굳히면 crypto_assets에 시드된 뒤에도
        // 임시 항목이 남아 자가 치유를 늦춘다. 시드되면 위 DB 경로가 바로 잡는다.
        return {
            symbol: upper,
            name,
            marketProfile: 'crypto',
        };
    }

    const fromDb = await readFromDatabase(upper);
    if (fromDb) return fromDb;

    // 번역 대기 중인 심볼의 임시 항목. DB 미스 뒤에서만 읽으므로 번역이 DB에 들어간
    // 순간부터는 이 항목이 DB 결과를 가리지 못한다.
    if (cache) {
        try {
            const provisional = await cache.get<AssetInfo>(cacheKey);
            if (provisional) return provisional;
        } catch {
            // Graceful degradation: cache read failure falls through to provider fetch.
        }
    }

    // 한국 상장 종목은 FMP 플랜이 커버하지 않으므로 아래 `searchBySymbol` 경로로 내려가면
    // 반드시 빈 결과 → null(=404)로 끝난다. DB·임시 항목 조회 뒤, FMP 조회 앞에 둬야 이미
    // 번역된 레코드는 DB에서 잡히고(yahoo 호출 0회), 신규 심볼만 yahoo로 이름을 해석한다.
    if (isKrEquitySymbol(upper)) {
        return resolveKrEquityAssetInfo(upper, cache);
    }

    const fmpResults = await searchBySymbol(upper, {
        throwOnInfraFailure: true,
    });
    const usResults = filterUsExchanges(fmpResults);
    // 정확 일치 비교는 FMP 표기 기준이어야 한다 — 정규화를 아는 코드는 fmpTickerApi에
    // 모여 있다(findExactUsMatch JSDoc 참조). 점이 없는 심볼은 정규화가 항등이라 종전과 동일.
    const match = findExactUsMatch(usResults, upper);
    if (!match) return null;

    const { symbol: fmpSymbol, name, exchange, exchangeFullName } = match;

    const displayNames = await lookupTickerDisplayNames([upper]);
    // DB 조회가 **실패**했으면(행 없음과 다르다) 번역도 저장도 하지 않고 영문명 정보만
    // 돌려준다 — 이미 번역된 심볼일 수 있는데 "번역 없음"으로 읽으면 장애 동안 심볼마다
    // Gemini 번역이 돈다(SERVER.md#DC-8). 임시 항목도 쓰지 않아, DB가 돌아오면 다음 요청이
    // 정상 경로를 탄다. 이 응답은 `unstable_cache` 안에서 굳을 수 있으나 영문명 degrade다.
    if (displayNames === null) {
        return {
            symbol: upper,
            name,
            ...(fmpSymbol !== upper && { fmpSymbol }),
        };
    }
    const koreanName = reusableKoreanName(upper, name, displayNames[upper]);

    const info: AssetInfo = {
        symbol: upper,
        name,
        ...(fmpSymbol !== upper && { fmpSymbol }),
        ...(koreanName && { koreanName }),
    };

    if (koreanName) {
        fireAndForget(
            persistOrCacheProvisional(
                { ...info, koreanName },
                fmpSymbol,
                cache
            ).catch(e => console.warn('[getAssetInfo] persist failed', e))
        );
        return info;
    }

    fireAndForget(
        translateAndPersist(
            upper,
            { symbol: fmpSymbol, name, exchange, exchangeFullName },
            cache
        ).catch(e =>
            console.warn('[getAssetInfo] background translation failed', e)
        )
    );

    // 번역이 끝날 때까지 FMP 재조회를 막는 12시간 임시 항목. 읽기는 DB 미스 뒤에서 한다.
    setCacheBestEffort(
        cache,
        cacheKey,
        info,
        ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN
    );

    return info;
}
