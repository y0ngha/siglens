import { waitUntil } from '@vercel/functions';
import { isValidTickerFormat } from './ticker';
import { DrizzleAssetTranslationRepository } from '../api';
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
import { filterUsExchanges, searchBySymbol } from './fmpTickerApi';
import { translateCompanyNames } from './koreanTranslator';
import { getKoreanNames, setKoreanTickers } from './koreanNameStore';
import type { AssetInfoMatch } from './backgroundTask';
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

/** Single-flight registry for fire-and-forget translate-and-persist work; collapses concurrent calls for the same symbol into one Gemini request. */
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

/** @internal Test helper — clears the in-flight registry between cases. */
export function _resetInFlightTranslationsForTest(): void {
    translationSingleFlight._resetForTest();
}

/** Resolve canonical asset information for a single ticker symbol via cache → DB → FMP, with optional background Korean-name translation. */
export async function getAssetInfo(symbol: string): Promise<AssetInfo | null> {
    const upper = symbol.toUpperCase();
    if (!isValidTickerFormat(upper)) return null;

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

    const fmpResults = await searchBySymbol(upper, { strict: true });
    const usResults = filterUsExchanges(fmpResults);
    const match = usResults.find(r => r.symbol === upper) ?? usResults[0];
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
        waitUntil(
            persistTranslation(upper, fmpSymbol, name, koreanName, cache).catch(
                e => console.warn('[getAssetInfo] persist failed', e)
            )
        );
        return info;
    }

    waitUntil(
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
