'use server';

import { waitUntil } from '@vercel/functions';
import { cache } from 'react';
import { createCacheProvider } from '@/infrastructure/cache/redis';
import {
    ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN,
    ASSET_INFO_CACHE_TTL_WITH_KOREAN,
    buildAssetInfoCacheKey,
} from '@/infrastructure/cache/config';
import {
    searchBySymbol,
    filterUsExchanges,
    filterIndexResults,
} from '@/infrastructure/ticker/fmpTickerApi';
import type { FmpSearchResult } from '@/infrastructure/ticker/types';
import {
    getKoreanNames,
    setKoreanTickers,
} from '@/infrastructure/ticker/koreanNameStore';
import { translateCompanyNames } from '@/infrastructure/ticker/koreanTranslator';
import { isValidTickerFormat } from '@/domain/ticker';
import type { AssetInfo, KoreanTickerEntry } from '@/domain/types';

async function findIndexMatch(
    symbol: string
): Promise<FmpSearchResult | undefined> {
    const results = await searchBySymbol(`^${symbol}`);
    const indexResults = filterIndexResults(results);
    return indexResults.find(r => r.symbol === `^${symbol}`) ?? indexResults[0];
}

async function translateAndCache(
    symbol: string,
    name: string,
    exchange: string,
    exchangeFullName: string,
    fmpSymbol?: string
): Promise<void> {
    const translated = await translateCompanyNames([{ symbol, name }]);
    const koreanName = translated[symbol];
    if (!koreanName) return;

    const entry: KoreanTickerEntry = {
        symbol,
        name,
        koreanName,
        exchange,
        exchangeFullName,
    };
    await setKoreanTickers([entry]);

    const cacheProvider = createCacheProvider();
    if (cacheProvider) {
        const cacheKey = buildAssetInfoCacheKey(symbol);
        await cacheProvider
            .set(
                cacheKey,
                { symbol, name, koreanName, ...(fmpSymbol && { fmpSymbol }) },
                ASSET_INFO_CACHE_TTL_WITH_KOREAN
            )
            .catch(error =>
                console.error(
                    'Asset info cache update after translation failed:',
                    error
                )
            );
    }
}

const resolveAssetInfo = cache(
    async (symbol: string): Promise<AssetInfo | null> => {
        const upper = symbol.toUpperCase();

        if (!isValidTickerFormat(upper)) return null;

        const cacheProvider = createCacheProvider();
        const cacheKey = buildAssetInfoCacheKey(upper);

        if (cacheProvider) {
            try {
                const cached = await cacheProvider.get<AssetInfo>(cacheKey);
                if (cached) return cached;
            } catch (error) {
                console.error('Asset info cache get failed:', error);
            }
        }

        const fmpResults = await searchBySymbol(upper);
        const usResults = filterUsExchanges(fmpResults);
        const exactUsMatch = usResults.find(r => r.symbol === upper);
        const indexMatch = exactUsMatch
            ? undefined
            : await findIndexMatch(upper);
        const match = exactUsMatch ?? indexMatch ?? usResults[0];

        if (!match) return null;

        const { name, exchange, exchangeFullName } = match;

        const koreanNames = await getKoreanNames([upper]);
        const koreanName = koreanNames[upper];

        const info: AssetInfo = {
            symbol: upper,
            name,
            ...(koreanName && { koreanName }),
            ...(indexMatch && { fmpSymbol: indexMatch.symbol }),
        };

        if (!koreanName) {
            waitUntil(
                translateAndCache(
                    upper,
                    name,
                    exchange,
                    exchangeFullName,
                    indexMatch?.symbol
                ).catch(error =>
                    console.error('Asset info translateAndCache failed:', error)
                )
            );
        }

        if (cacheProvider) {
            const ttl = koreanName
                ? ASSET_INFO_CACHE_TTL_WITH_KOREAN
                : ASSET_INFO_CACHE_TTL_WITHOUT_KOREAN;
            waitUntil(
                cacheProvider
                    .set(cacheKey, info, ttl)
                    .catch(error =>
                        console.error('Asset info cache set failed:', error)
                    )
            );
        }

        return info;
    }
);

export async function getAssetInfoAction(
    symbol: string
): Promise<AssetInfo | null> {
    return resolveAssetInfo(symbol.toUpperCase());
}
