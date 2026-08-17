import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
import { isKrEquitySymbol } from '@/shared/config/marketProfile';
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
    ASSET_INFO_CACHE_TTL_WITH_KOREAN,
    ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN,
    buildAssetInfoCacheKey,
} from './cacheKeys';
import { tryGetTickerDatabaseClient } from './db';
import {
    filterUsExchanges,
    findExactUsMatch,
    searchBySymbol,
} from './fmpTickerApi';
import { translateCompanyNames } from './koreanTranslator';
import { getKoreanNames, setKoreanTickers } from './koreanNameStore';
import type { AssetInfoMatch } from './backgroundTask';
import { fireAndForget } from './backgroundTask';
import { createSingleFlight } from './utils/singleFlight';
import { createCacheProvider, type CacheProvider } from '@y0ngha/siglens-core';
import type { AssetInfo, KoreanTickerEntry } from '@/shared/lib/types';

function tryGetRepository(): AssetTranslationRepository | null {
    const client = tryGetTickerDatabaseClient();
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
 * Neon wraps the originating error as `cause.sourceError`. We unwrap it to
 * detect AbortError, which fires on every navigation when Next.js cancels
 * in-flight requests — this is expected behaviour and should not be logged.
 */
function isAbortError(e: unknown): boolean {
    if (!(e instanceof Error)) return false;
    if (e.name === 'AbortError') return true;
    const neonError = (e as Error & { cause?: unknown }).cause;
    if (!(neonError instanceof Error)) return false;
    const sourceError = (neonError as Error & { sourceError?: unknown })
        .sourceError;
    return sourceError instanceof Error && sourceError.name === 'AbortError';
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

async function persistTranslation(
    symbol: string,
    fmpSymbol: string,
    name: string,
    koreanName: string,
    cache: CacheProvider | null
): Promise<void> {
    const repository = tryGetRepository();
    if (repository) {
        try {
            await repository.upsert({
                symbol,
                name,
                koreanName,
                fmpSymbol,
            });
        } catch (e) {
            console.warn('[getAssetInfo] DB upsert failed', e);
            // DB 실패여도 캐시는 갱신해야 12시간 영문 캐시가 유지되는 문제를 방지한다.
        }
    }

    setCacheBestEffort(
        cache,
        buildAssetInfoCacheKey(symbol),
        {
            symbol,
            name,
            koreanName,
            ...(fmpSymbol !== symbol && { fmpSymbol }),
        },
        ASSET_INFO_CACHE_TTL_WITH_KOREAN
    );
}

/** Single-flight registry for fire-and-forget translate-and-persist work; collapses concurrent calls for the same symbol into one translation request. */
const translationSingleFlight = createSingleFlight<void>();

function translateAndPersist(
    symbol: string,
    match: AssetInfoMatch,
    cache: CacheProvider | null
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
        await persistTranslation(
            symbol,
            match.symbol,
            match.name,
            koreanName,
            cache
        );
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
            persistTranslation(upper, upper, name, koreanName, cache).catch(e =>
                console.warn('[getAssetInfo] kr persist failed', e)
            )
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
            cache
        ).catch(e =>
            console.warn('[getAssetInfo] kr background translation failed', e)
        )
    );

    setCacheBestEffort(
        cache,
        buildAssetInfoCacheKey(upper),
        info,
        ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN
    );

    return info;
}

/** Test helper — clears the in-flight registry between cases. */
export function _resetInFlightTranslationsForTest(): void {
    translationSingleFlight._resetForTest();
}

/** Resolve canonical asset information for a single ticker symbol via cache → DB → FMP, with optional background Korean-name translation. */
export async function getAssetInfo(symbol: string): Promise<AssetInfo | null> {
    const upper = symbol.toUpperCase();
    if (!isAdmissibleSymbolShape(upper)) return null;

    const cache = createCacheProvider();
    const cacheKey = buildAssetInfoCacheKey(upper);

    if (cache) {
        try {
            const cached = await cache.get<AssetInfo>(cacheKey);
            if (cached) return cached;
        } catch {
            // Graceful degradation: cache read failure falls through to provider fetch.
        }
    }

    // Crypto classification is authoritative via crypto_assets membership.
    // FMP profile is empty for crypto, so name comes from DB (fallback: quote).
    const cryptoAsset = await getCryptoAsset(upper);
    if (cryptoAsset) {
        const name = cryptoAsset.name || (await fetchCryptoQuoteName(upper));
        const cryptoInfo: AssetInfo = {
            symbol: upper,
            name,
            marketProfile: 'crypto',
            ...(cryptoAsset.koreanName
                ? { koreanName: cryptoAsset.koreanName }
                : {}),
        };
        setCacheBestEffort(
            cache,
            cacheKey,
            cryptoInfo,
            ASSET_INFO_CACHE_TTL_WITH_KOREAN
        );
        return cryptoInfo;
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
        const fmpCryptoInfo: AssetInfo = {
            symbol: upper,
            name,
            marketProfile: 'crypto',
        };
        // FMP-list records have no koreanName and are provisional (valid only until
        // the next crypto_assets re-seed). The 12 h TTL lets the record self-heal:
        // once the symbol is seeded with a koreanName, the next request after
        // cache expiry will find it in crypto_assets and write a WITH_KOREAN entry.
        // Using WITH_KOREAN (1 yr) here would lock in the incomplete record and
        // prevent self-healing — same reasoning as the WITHOUT_KOREAN path for
        // equities still awaiting translation.
        setCacheBestEffort(
            cache,
            cacheKey,
            fmpCryptoInfo,
            ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN
        );
        return fmpCryptoInfo;
    }

    const fromDb = await readFromDatabase(upper);
    if (fromDb) {
        setCacheBestEffort(
            cache,
            cacheKey,
            fromDb,
            ASSET_INFO_CACHE_TTL_WITH_KOREAN
        );
        return fromDb;
    }

    // 한국 상장 종목은 FMP 플랜이 커버하지 않으므로 아래 `searchBySymbol` 경로로 내려가면
    // 반드시 빈 결과 → null(=404)로 끝난다. DB 조회 뒤, FMP 조회 앞에 둬야 이미 번역된
    // 레코드는 DB에서 잡히고(yahoo 호출 0회), 신규 심볼만 yahoo로 이름을 해석한다.
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

    const koreanNames = await getKoreanNames([upper]);
    const koreanName = koreanNames[upper];

    const info: AssetInfo = {
        symbol: upper,
        name,
        ...(fmpSymbol !== upper && { fmpSymbol }),
        ...(koreanName && { koreanName }),
    };

    if (koreanName) {
        fireAndForget(
            persistTranslation(upper, fmpSymbol, name, koreanName, cache).catch(
                e => console.warn('[getAssetInfo] persist failed', e)
            )
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

    setCacheBestEffort(
        cache,
        cacheKey,
        info,
        ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN
    );

    return info;
}
