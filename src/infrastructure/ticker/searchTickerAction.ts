'use server';

import { waitUntil } from '@vercel/functions';
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
    filterIndexResults,
    toDisplaySymbol,
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

    const cacheProvider = createCacheProvider();
    const cacheKey = buildTickerSearchCacheKey(trimmed);

    if (cacheProvider) {
        try {
            const cached =
                await cacheProvider.get<TickerSearchResult[]>(cacheKey);
            if (cached) return cached;
        } catch (error) {
            console.error('Ticker search cache get failed:', error);
        }
    }

    const [symbolResults, nameResults, indexResults] = await Promise.all([
        searchBySymbol(trimmed),
        searchByName(trimmed),
        searchBySymbol(`^${trimmed}`),
    ]);

    const toIndexResult = (r: (typeof indexResults)[number]) =>
        toTickerSearchResult({ ...r, symbol: toDisplaySymbol(r.symbol) });

    const merged = deduplicateResults([
        ...filterUsExchanges(symbolResults).map(toTickerSearchResult),
        ...filterUsExchanges(nameResults).map(toTickerSearchResult),
        // 정규 검색 결과에 포함된 지수 심볼 (FMP가 ^ prefix 결과를 함께 반환하는 경우)
        ...filterIndexResults(symbolResults).map(toIndexResult),
        // ^{trimmed} 직접 검색 결과 (심볼 직접 입력 시)
        ...filterIndexResults(indexResults).map(toIndexResult),
    ]);

    const koreanNames = await getKoreanNames(merged.map(r => r.symbol));

    const enriched = merged.map(result => ({
        ...result,
        koreanName: koreanNames[result.symbol],
    }));

    const unmapped = enriched.filter(r => !r.koreanName);
    if (unmapped.length > 0) {
        waitUntil(
            translateAndCache(unmapped).catch(error =>
                console.error('translateAndCache waitUntil failed:', error)
            )
        );
    }

    const final = enriched.slice(0, MAX_SEARCH_RESULTS);

    if (cacheProvider) {
        waitUntil(
            cacheProvider
                .set(cacheKey, final, TICKER_SEARCH_CACHE_TTL)
                .catch(error =>
                    console.error('Ticker search cache set failed:', error)
                )
        );
    }

    return final;
}
