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

async function translateAndPersist(
    symbol: string,
    match: AssetInfoMatch,
    cache: CacheProvider | null
): Promise<void> {
    const translated = await translateCompanyNames([
        { symbol, name: match.name },
    ]);
    const koreanName = translated[symbol];
    if (!koreanName) return;

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
}

/**
 * Resolve canonical asset information for a single ticker symbol.
 *
 * Pipeline: validate format → cache → asset_translations DB → FMP search →
 * Korean-name join (or background translation). Cache, DB, and translation
 * failures are logged but never propagate.
 */
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
