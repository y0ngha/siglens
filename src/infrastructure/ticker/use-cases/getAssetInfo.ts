import { isValidTickerFormat } from '@/domain/ticker';
import { DrizzleAssetTranslationRepository } from '@/infrastructure/db/tickerRepository';
import type {
    AssetTranslationRecord,
    AssetTranslationRepository,
} from '@/infrastructure/db/types';
import {
    ASSET_INFO_CACHE_TTL_WITH_KOREAN,
    ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN,
    buildAssetInfoCacheKey,
} from '@/infrastructure/ticker/cacheKeys';
import { tryGetTickerDatabaseClient } from '@/infrastructure/ticker/db';
import {
    filterUsExchanges,
    searchBySymbol,
} from '@/infrastructure/ticker/fmpTickerApi';
import { translateCompanyNames } from '@/infrastructure/ticker/koreanTranslator';
import {
    getKoreanNames,
    setKoreanTickers,
} from '@/infrastructure/ticker/use-cases/koreanNameStore';
import type { AssetInfoMatch } from '@/infrastructure/ticker/use-cases/types';
import { createCacheProvider, type CacheProvider } from '@y0ngha/siglens-core';
import type { AssetInfo, KoreanTickerEntry } from '@/domain/types';

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

async function readFromDatabase(symbol: string): Promise<AssetInfo | null> {
    const repository = tryGetRepository();
    if (!repository) return null;

    try {
        const record = await repository.findBySymbol(symbol);
        return record ? recordToAssetInfo(record) : null;
    } catch (e) {
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
            return;
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

/**
 * Per-symbol in-flight registry for background translate-and-persist work.
 *
 * `translateAndPersist` is invoked fire-and-forget from {@link getAssetInfo}.
 * Without single-flight, N concurrent requests for the same uncached symbol
 * each call Gemini independently. The registry collapses concurrent calls to
 * one shared Promise; the entry is cleared in `.finally()` so failures do not
 * permanently block retries on the next call.
 */
const inFlightTranslations = new Map<string, Promise<void>>();

async function translateAndPersist(
    symbol: string,
    match: AssetInfoMatch,
    cache: CacheProvider | null
): Promise<void> {
    const existing = inFlightTranslations.get(symbol);
    if (existing) return existing;

    const work = (async () => {
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
    })().finally(() => {
        inFlightTranslations.delete(symbol);
    });

    inFlightTranslations.set(symbol, work);
    return work;
}

/** @internal Test helper — clears the in-flight registry between cases. */
export function _resetInFlightTranslationsForTest(): void {
    inFlightTranslations.clear();
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

    const fmpResults = await searchBySymbol(upper);
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
        persistTranslation(upper, fmpSymbol, name, koreanName, cache).catch(e =>
            console.warn('[getAssetInfo] persist failed', e)
        );
        return info;
    }

    translateAndPersist(
        upper,
        { symbol: fmpSymbol, name, exchange, exchangeFullName },
        cache
    ).catch(e =>
        console.warn('[getAssetInfo] background translation failed', e)
    );

    setCacheBestEffort(
        cache,
        cacheKey,
        info,
        ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN
    );

    return info;
}
