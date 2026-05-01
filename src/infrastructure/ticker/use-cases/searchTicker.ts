import { deduplicateResults, isKoreanInput } from '@/domain/ticker';
import {
    buildTickerSearchCacheKey,
    TICKER_SEARCH_CACHE_TTL,
} from '@/infrastructure/ticker/cacheKeys';
import {
    filterUsExchanges,
    searchByName,
    searchBySymbol,
    toTickerSearchResult,
} from '@/infrastructure/ticker/fmpTickerApi';
import { translateCompanyNames } from '@/infrastructure/ticker/koreanTranslator';
import {
    getKoreanNames,
    searchByKoreanName,
    setKoreanTickers,
} from '@/infrastructure/ticker/use-cases/koreanNameStore';
import {
    fireAndForget,
    type BackgroundTaskOptions,
} from '@/infrastructure/ticker/use-cases/types';
import { createCacheProvider } from '@y0ngha/siglens-core';
import type { KoreanTickerEntry, TickerSearchResult } from '@/domain/types';

const MAX_SEARCH_RESULTS = 10;

function toKoreanEntry(
    symbol: string,
    koreanName: string,
    unmappedMap: Map<string, TickerSearchResult>
): KoreanTickerEntry[] {
    const result = unmappedMap.get(symbol);
    if (!result) return [];
    return [
        {
            symbol,
            koreanName,
            name: result.name,
            exchange: result.exchange,
            exchangeFullName: result.exchangeFullName,
        },
    ];
}

async function translateAndCache(
    unmapped: TickerSearchResult[]
): Promise<void> {
    const translated = await translateCompanyNames(
        unmapped.map(r => ({ symbol: r.symbol, name: r.name }))
    );

    const unmappedMap = new Map(unmapped.map(r => [r.symbol, r]));

    const entries = Object.entries(translated).flatMap<KoreanTickerEntry>(
        ([symbol, koreanName]) => toKoreanEntry(symbol, koreanName, unmappedMap)
    );

    await setKoreanTickers(entries);
}

/**
 * Search for tickers by symbol or company name, with bilingual support.
 *
 * Behaviour depends on the input language detected by {@link isKoreanInput}:
 * - **Korean input**: searched against the persistent Korean-name store.
 * - **English / symbol input**: cache lookup → FMP `searchBySymbol` +
 *   `searchByName` in parallel → filter to U.S. exchanges → deduplicate.
 *   Korean names are joined from the persistent store; symbols without a
 *   translation trigger a background translation job.
 *
 * Cache and background-translation failures are logged but never propagate.
 * Results are capped at 10 entries.
 */
export async function searchTicker(
    query: string,
    options?: BackgroundTaskOptions
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
        try {
            const cached = await cache.get<TickerSearchResult[]>(cacheKey);
            if (cached) return cached;
        } catch {
            // Graceful degradation: cache read failure falls through to provider fetch.
        }
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
        fireAndForget(
            translateAndCache(unmapped).catch(e =>
                console.warn('[searchTicker] background translation failed', e)
            ),
            options
        );
    }

    const final = enriched.slice(0, MAX_SEARCH_RESULTS);

    if (cache) {
        fireAndForget(
            cache
                .set(cacheKey, final, TICKER_SEARCH_CACHE_TTL)
                .catch(e =>
                    console.warn('[searchTicker] cache write failed', e)
                ),
            options
        );
    }

    return final;
}
