'use server';

import { createCacheProvider } from '@/infrastructure/cache/redis';
import {
    TICKER_SEARCH_CACHE_TTL,
    buildTickerSearchCacheKey,
} from '@/infrastructure/cache/config';
import { isKoreanInput, deduplicateResults } from '@/domain/ticker';
import {
    searchBySymbol,
    searchByName,
    filterUsExchanges,
    toTickerSearchResult,
} from '@/infrastructure/ticker/fmpTickerApi';
import {
    searchByKoreanName,
    getKoreanNames,
    setKoreanTickers,
} from '@/infrastructure/ticker/koreanNameStore';
import { translateCompanyNames } from '@/infrastructure/ticker/koreanTranslator';
import type { TickerSearchResult, KoreanTickerEntry } from '@/domain/types';

const MAX_SEARCH_RESULTS = 10;

async function translateAndCache(
    unmapped: TickerSearchResult[]
): Promise<void> {
    const translated = await translateCompanyNames(
        unmapped.map(r => ({ symbol: r.symbol, name: r.name }))
    );

    const unmappedMap = new Map(unmapped.map(r => [r.symbol, r]));

    const entries: KoreanTickerEntry[] = Object.entries(translated)
        .map(([symbol, koreanName]) => {
            const result = unmappedMap.get(symbol);
            if (!result) return null;
            return {
                symbol,
                koreanName,
                name: result.name,
                exchange: result.exchange,
                exchangeFullName: result.exchangeFullName,
            };
        })
        .filter((e): e is KoreanTickerEntry => e !== null);

    await setKoreanTickers(entries);
}

export async function searchTickerAction(
    query: string
): Promise<TickerSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    if (isKoreanInput(trimmed)) {
        const results = await searchByKoreanName(trimmed);
        return results.slice(0, MAX_SEARCH_RESULTS);
    }

    const cache = createCacheProvider();
    const cacheKey = buildTickerSearchCacheKey(trimmed);

    if (cache) {
        const cached = await cache.get<TickerSearchResult[]>(cacheKey);
        if (cached) return cached;
    }

    const [symbolResults, nameResults] = await Promise.all([
        searchBySymbol(trimmed),
        searchByName(trimmed),
    ]);

    const merged = deduplicateResults([
        ...filterUsExchanges(symbolResults).map(toTickerSearchResult),
        ...filterUsExchanges(nameResults).map(toTickerSearchResult),
    ]);

    const koreanNames = await getKoreanNames(merged.map(r => r.symbol));

    const enriched = merged.map(result => ({
        ...result,
        koreanName: koreanNames[result.symbol],
    }));

    const unmapped = enriched.filter(r => !r.koreanName);
    if (unmapped.length > 0) {
        translateAndCache(unmapped).catch(error =>
            console.error('translateAndCache fire-and-forget failed:', error)
        );
    }

    const final = enriched.slice(0, MAX_SEARCH_RESULTS);

    if (cache) {
        cache
            .set(cacheKey, final, TICKER_SEARCH_CACHE_TTL)
            .catch(error =>
                console.error('Ticker search cache set failed:', error)
            );
    }

    return final;
}
