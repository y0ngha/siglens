import { deduplicateResults, isKoreanInput } from './ticker';
import {
    buildTickerSearchCacheKey,
    TICKER_SEARCH_CACHE_TTL,
} from './cacheKeys';
import {
    filterUsExchanges,
    searchByName,
    searchBySymbol,
    toTickerSearchResult,
} from './fmpTickerApi';
import { translateCompanyNames } from './koreanTranslator';
import {
    getKoreanNames,
    searchByKoreanName,
    setKoreanTickers,
} from './koreanNameStore';
import { searchCryptoAssets } from './cryptoAssetStore';
import { fireAndForget, type BackgroundTaskOptions } from './backgroundTask';
import { createSingleFlight } from './utils/singleFlight';
import { createCacheProvider } from '@y0ngha/siglens-core';
import type { KoreanTickerEntry, TickerSearchResult } from '@/shared/lib/types';

export const MAX_SEARCH_RESULTS = 10;

/**
 * When a Korean search returns both stock and crypto results, reserve this many
 * slots for crypto so Korean coin searches aren't starved by a high volume of
 * stock name matches. The actual crypto slots may be fewer if fewer crypto
 * results exist; unused budget flows back to stock.
 */
export const CRYPTO_RESERVE = 3;

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

/** Single-flight registry keyed by sorted-symbol list; collapses concurrent identical search queries into one Gemini call. */
const translationSingleFlight = createSingleFlight<void>();

function buildInFlightKey(symbols: readonly string[]): string {
    return [...symbols].sort().join(',');
}

function translateAndCache(unmapped: TickerSearchResult[]): Promise<void> {
    const key = buildInFlightKey(unmapped.map(r => r.symbol));
    return translationSingleFlight.run(key, async () => {
        const translated = await translateCompanyNames(
            unmapped.map(r => ({ symbol: r.symbol, name: r.name }))
        );

        const unmappedMap = new Map(unmapped.map(r => [r.symbol, r]));

        const entries = Object.entries(translated).flatMap<KoreanTickerEntry>(
            ([symbol, koreanName]) =>
                toKoreanEntry(symbol, koreanName, unmappedMap)
        );

        await setKoreanTickers(entries);
    });
}

/** @internal Test helper — clears the in-flight registry between cases. */
export function _resetInFlightTranslationsForTest(): void {
    translationSingleFlight._resetForTest();
}

/** Search for tickers by symbol or company name with bilingual support; Korean queries hit the Korean-name store, others hit FMP via cache with background translation enrichment (capped at 10 entries). */
export async function searchTicker(
    query: string,
    options?: BackgroundTaskOptions
): Promise<TickerSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    if (isKoreanInput(trimmed)) {
        // Stock Korean names come from the korean_tickers table; crypto Korean names
        // come from crypto_assets.korean_name. Run both in parallel so a single
        // Korean keypress (e.g. "비트코") surfaces both stock and crypto matches.
        const [stockResults, cryptoResults] = await Promise.all([
            searchByKoreanName(trimmed),
            // Isolated catch so a crypto DB error doesn't discard stock results.
            searchCryptoAssets(trimmed).catch((): TickerSearchResult[] => []),
        ]);
        // Guarantee crypto representation: reserve up to CRYPTO_RESERVE slots for
        // crypto results when they exist, so Korean coin searches aren't lost when
        // many stock name matches fill the cap. Unused crypto budget flows to stock.
        const cryptoCap = Math.min(cryptoResults.length, CRYPTO_RESERVE);
        const cappedStock = stockResults.slice(
            0,
            MAX_SEARCH_RESULTS - cryptoCap
        );
        const remainingSlots = MAX_SEARCH_RESULTS - cappedStock.length;
        const cappedCrypto = cryptoResults.slice(0, remainingSlots);
        // deduplicateResults guards the unlikely case where a symbol exists in both stores.
        const merged = deduplicateResults([...cappedStock, ...cappedCrypto]);
        return merged.slice(0, MAX_SEARCH_RESULTS);
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

    const [symbolResults, nameResults, cryptoResults] = await Promise.all([
        searchBySymbol(trimmed),
        searchByName(trimmed),
        searchCryptoAssets(trimmed),
    ]);

    const merged = deduplicateResults([
        ...filterUsExchanges(symbolResults).map(toTickerSearchResult),
        ...filterUsExchanges(nameResults).map(toTickerSearchResult),
        ...cryptoResults,
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
