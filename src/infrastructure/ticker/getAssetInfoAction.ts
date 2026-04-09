'use server';

import { cache } from 'react';
import { createCacheProvider } from '@/infrastructure/cache/redis';
import {
    ASSET_INFO_CACHE_TTL,
    buildAssetInfoCacheKey,
} from '@/infrastructure/cache/config';
import {
    searchBySymbol,
    filterUsExchanges,
} from '@/infrastructure/ticker/fmpTickerApi';
import {
    getKoreanNames,
    setKoreanTickers,
} from '@/infrastructure/ticker/koreanNameStore';
import { translateCompanyNames } from '@/infrastructure/ticker/koreanTranslator';
import type { AssetInfo, KoreanTickerEntry } from '@/domain/types';

async function translateAndCache(
    symbol: string,
    name: string,
    exchange: string,
    exchangeFullName: string
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
        cacheProvider
            .set(cacheKey, { symbol, name, koreanName }, ASSET_INFO_CACHE_TTL)
            .catch(error =>
                console.error(
                    'Asset info cache update after translation failed:',
                    error
                )
            );
    }
}

const resolveAssetInfo = cache(async (symbol: string): Promise<AssetInfo> => {
    const upper = symbol.toUpperCase();
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
    const match = usResults.find(r => r.symbol === upper) ?? usResults[0];

    const name = match?.name ?? upper;
    const exchange = match?.exchange ?? '';
    const exchangeFullName = match?.exchangeFullName ?? '';

    const koreanNames = await getKoreanNames([upper]);
    const koreanName = koreanNames[upper];

    const info: AssetInfo = {
        symbol: upper,
        name,
        ...(koreanName && { koreanName }),
    };

    if (!koreanName && match) {
        translateAndCache(upper, name, exchange, exchangeFullName).catch(
            error =>
                console.error('Asset info translateAndCache failed:', error)
        );
    }

    if (cacheProvider) {
        cacheProvider
            .set(cacheKey, info, ASSET_INFO_CACHE_TTL)
            .catch(error =>
                console.error('Asset info cache set failed:', error)
            );
    }

    return info;
});

export async function getAssetInfoAction(symbol: string): Promise<AssetInfo> {
    return resolveAssetInfo(symbol.toUpperCase());
}
