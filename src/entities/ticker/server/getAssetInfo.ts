import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import { fetchKrEquityQuoteName } from './krEquityQuoteName';
import { krExchangeOf } from '../lib/krExchange';
import { resolveIndexAlias } from '../lib/indexAlias';
import { CURATED_KOREAN_NAMES } from '@/shared/config/popular-tickers';
import { getCryptoAsset } from './cryptoAssetStore';
import { fetchCryptoQuoteName } from './cryptoQuoteName';
import { fmpCryptoMembership } from './fmpCryptoMembership';
import {
    API_UNTRANSLATED_CACHE_TTL,
    ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN,
    buildApiAssetInfoCacheKey,
    buildAssetInfoProvisionalCacheKey,
} from '../lib/cacheKeys';
import {
    filterUsExchanges,
    findExactUsMatch,
    searchBySymbol,
} from './fmpTickerApi';
import { isServerLlmAllowed } from '@/shared/lib/serverLlmPolicy';
import { translateCompanyNames } from './koreanTranslator';
import {
    getKoreanNames,
    lookupTickerDisplayNames,
    setKoreanTickers,
} from './koreanNameStore';
import {
    reusableKoreanName,
    withCanonicalKoreanName,
} from '../lib/assetInfoResolution';
import {
    persistOrCacheProvisional,
    readFromDatabase,
    setCacheBestEffort,
} from './assetInfoPersistence';
import { fireAndForget } from '@/shared/lib/backgroundTask';
import {
    createSingleFlight,
    __resetSingleFlightForTests,
} from '@/shared/lib/singleFlight';
import { createCacheProvider, type CacheProvider } from '@y0ngha/siglens-core';
import type { AssetInfo, KoreanTickerEntry } from '@/shared/lib/types';

/**
 * 서버 키 LLM을 못 쓰는 흐름(공개 API)이면 번역 없이 영문명 결과를 API 전용 키에 1시간 두고 `true`를 돌려준다.
 * 웹의 12시간 임시 항목은 쓰지 않는다(웹의 번역 시도까지 막는다) — API 전용 키는 반복 호출이 FMP/Yahoo를
 * 다시 부르지 않게 할 뿐이다. 웹은 이 키를 읽지 않고, 웹이 번역해 DB에 넣으면 DB 조회가 먼저 잡는다.
 * 웹 흐름이면 아무것도 하지 않고 `false` — 호출부가 평소처럼 번역을 시작한다.
 */
function cacheUntranslatedForApi(
    upper: string,
    info: AssetInfo,
    cache: CacheProvider | null
): boolean {
    if (isServerLlmAllowed()) return false;
    setCacheBestEffort(
        cache,
        buildApiAssetInfoCacheKey(upper),
        info,
        API_UNTRANSLATED_CACHE_TTL
    );
    return true;
}

/** 번역을 저장할 때 필요한 FMP 검색 결과의 일부. */
interface AssetInfoMatch {
    symbol: string;
    name: string;
    exchange: string;
    exchangeFullName: string;
}

/** 번역·저장 백그라운드 작업의 single-flight 레지스트리 — 같은 심볼의 동시 호출을 번역 요청 한 번으로 합친다. */
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

        // 매핑 의도(뒤집지 말 것):
        // - korean_tickers.symbol은 정본(cashtag) 심볼이다. 예: "AAPL"
        // - asset_translations.symbol은 정본 심볼(PK)이다.
        // - asset_translations.fmp_symbol은 FMP 쪽 심볼이다. 예: "AAPL.MX"
        // 미국 주식은 정본 === fmpSymbol이고, 지수 등에서 갈린다.
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

    if (cacheUntranslatedForApi(upper, info, cache)) return info;

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

/** 테스트 전용 — 케이스 사이에 진행 중 번역 레지스트리를 비운다. */
export function _resetInFlightTranslationsForTest(): void {
    __resetSingleFlightForTests(translationSingleFlight);
}

/**
 * 심볼 하나의 정본 자산 정보를 해석한다.
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
 * 해석 순서: `crypto_assets` DB → FMP 크립토 목록 → 미국 지수 별칭(`MARKET_INDICES`) →
 * `asset_translations` DB →
 * Redis 임시 항목(12시간) → (서버 키 LLM을 못 쓰는 공개 API 흐름만) API 전용 번역 없는 항목(1시간) →
 * 한국 종목(yahoo) → FMP 검색.
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
 * 항목의 영문 이름이 12시간 늦게까지 남지 않는다. 공개 API 흐름은 번역을 하지 않으므로 웹 임시 항목을
 * 쓰지 않고(웹의 번역 시도를 막는다) 전용 키 `buildApiAssetInfoCacheKey`에 1시간만 둔다 — 반복 호출이
 * FMP/Yahoo를 다시 부르지 않게 하는 용도이고, 웹은 이 키를 읽지 않는다.
 */
async function resolveAssetInfo(symbol: string): Promise<AssetInfo | null> {
    const upper = symbol.toUpperCase();
    if (!isAdmissibleSymbolShape(upper)) return null;

    const cache = createCacheProvider();
    const crypto = await resolveCryptoAssetInfo(upper);
    if (crypto) return crypto;

    // 미국 지수 별칭(VIX→^VIX 등)은 DB보다 먼저 — 예전 폴백이 저장한 `VIX→VIXM` 같은
    // 잘못된 행이 남아 있어도 지수가 이긴다(`resolveIndexAlias` JSDoc).
    const indexAlias = resolveIndexAlias(upper);
    if (indexAlias) return indexAlias;

    const fromDb = await readFromDatabase(upper);
    if (fromDb) return fromDb;

    const provisional = await readProvisional(upper, cache);
    if (provisional) return provisional;

    // 한국 상장 종목은 FMP 플랜이 커버하지 않으므로 아래 `searchBySymbol` 경로로 내려가면
    // 반드시 빈 결과 → null(=404)로 끝난다. DB·임시 항목 조회 뒤, FMP 조회 앞에 둬야 이미
    // 번역된 레코드는 DB에서 잡히고(yahoo 호출 0회), 신규 심볼만 yahoo로 이름을 해석한다.
    if (isKrEquitySymbol(upper)) {
        return resolveKrEquityAssetInfo(upper, cache);
    }

    return resolveUsEquityAssetInfo(upper, cache);
}

/**
 * 크립토 분류는 `crypto_assets` 멤버십이 정본이다(FMP 프로필은 크립토에서 비어 있어 이름은
 * DB, 없으면 quote에서 가져온다). DB에 없으면 FMP 크립토 목록(캐시 ~24h)으로 폴백한다 —
 * 아직 시드되지 않은 신규 코인이 다음 재시드까지 404가 되는 틈을 메운다. DB가 우선이고
 * (koreanName·supply), FMP 목록은 폴백일 뿐이다. `fmpCryptoMembership`은 인프라/FMP 실패 시
 * 던지지 않고 null로 degrade하므로 ISR 콜드 생성에서 500을 만들지 않는다.
 *
 * FMP 목록 레코드는 한글명이 없고 임시적(다음 `crypto_assets` 재시드 전까지만 유효)이다.
 * Redis에는 쓰지 않는다 — 목록 자체가 이미 캐시되어 있어 재조회가 싸고, 따로 굳히면
 * `crypto_assets`에 시드된 뒤에도 임시 항목이 남아 자가 치유를 늦춘다. 시드되면 DB 경로가
 * 바로 잡는다.
 *
 * @returns 크립토가 아니면 `null`.
 */
async function resolveCryptoAssetInfo(
    upper: string
): Promise<AssetInfo | null> {
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

    const fmpEntry = await fmpCryptoMembership(upper);
    if (!fmpEntry) return null;
    const name = fmpEntry.name || (await fetchCryptoQuoteName(upper));
    return { symbol: upper, name, marketProfile: 'crypto' };
}

/**
 * 번역 대기 중인 심볼의 임시 항목을 읽는다. DB 미스 뒤에서만 읽으므로 번역이 DB에 들어간
 * 순간부터는 이 항목이 DB 결과를 가리지 못한다. 서버 키 LLM을 못 쓰는 흐름(공개 API)이
 * 남긴 번역 없는 항목은 그 흐름에서만 읽는다 — 웹은 이 키를 읽지 않는다.
 * 캐시 읽기 실패는 프로바이더 조회로 내려가는 graceful degradation이다.
 */
async function readProvisional(
    upper: string,
    cache: CacheProvider | null
): Promise<AssetInfo | null> {
    if (!cache) return null;
    try {
        const provisional = await cache.get<AssetInfo>(
            buildAssetInfoProvisionalCacheKey(upper)
        );
        if (provisional) return provisional;
        if (isServerLlmAllowed()) return null;
        return await cache.get<AssetInfo>(buildApiAssetInfoCacheKey(upper));
    } catch {
        return null;
    }
}

/** FMP 검색으로 미국 주식을 해석하고, 한글명이 없으면 백그라운드 번역을 시작한다. */
async function resolveUsEquityAssetInfo(
    upper: string,
    cache: CacheProvider | null
): Promise<AssetInfo | null> {
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

    if (cacheUntranslatedForApi(upper, info, cache)) return info;

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
        buildAssetInfoProvisionalCacheKey(upper),
        info,
        ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN
    );

    return info;
}
