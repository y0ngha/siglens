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
    // TODO: 지수 심볼 검색 재활성화 시 복원
    // filterIndexResults,
    // toDisplaySymbol,
    toTickerSearchResult,
} from '@/infrastructure/ticker/fmpTickerApi';
import {
    searchByKoreanName,
    getKoreanNames,
    setKoreanTickers,
} from '@/infrastructure/ticker/koreanNameStore';
import { translateCompanyNames } from '@/infrastructure/ticker/koreanTranslator';
import type { TickerSearchResult, KoreanTickerEntry } from '@/domain/types';
// TODO: 지수 심볼 검색 재활성화 시 복원
// import type { FmpSearchResult } from '@/infrastructure/ticker/types';

const MAX_SEARCH_RESULTS = 10;
// TODO: 지수 심볼 검색 재활성화 시 복원
// const MAX_INDEX_SYMBOL_LENGTH = 6;

// TODO: 지수 심볼 검색 재활성화 시 복원
// function toIndexTickerResult(r: FmpSearchResult): TickerSearchResult {
//     return toTickerSearchResult({ ...r, symbol: toDisplaySymbol(r.symbol) });
// }

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

    // TODO: 지수 심볼 검색 재활성화 시 아래 블록 복원
    // const shouldSearchIndex =
    //     !trimmed.startsWith('^') &&
    //     !trimmed.includes(' ') &&
    //     trimmed.length <= MAX_INDEX_SYMBOL_LENGTH;

    const [symbolResults, nameResults] = await Promise.all([
        searchBySymbol(trimmed),
        searchByName(trimmed),
        // shouldSearchIndex ? searchBySymbol(`^${trimmed}`) : Promise.resolve([]),
    ]);

    const merged = deduplicateResults([
        // TODO: 지수 심볼 검색 재활성화 시 아래 두 줄 복원
        // ...filterIndexResults(symbolResults).map(toIndexTickerResult),
        // ...filterIndexResults(indexResults).map(toIndexTickerResult),
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
