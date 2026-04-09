import { createCacheProvider } from '@/infrastructure/cache/redis';
import {
    KOREAN_NAMES_CACHE_TTL,
    KOREAN_TICKERS_CACHE_KEY,
} from '@/infrastructure/cache/config';
import type { KoreanTickerEntry, TickerSearchResult } from '@/domain/types';

function koreanEntryToSearchResult(
    entry: KoreanTickerEntry
): TickerSearchResult {
    return {
        symbol: entry.symbol,
        name: entry.name,
        koreanName: entry.koreanName,
        exchange: entry.exchange,
        exchangeFullName: entry.exchangeFullName,
    };
}

async function loadAllEntries(): Promise<KoreanTickerEntry[]> {
    const cache = createCacheProvider();
    if (!cache) return [];

    try {
        const entries = await cache.get<KoreanTickerEntry[]>(
            KOREAN_TICKERS_CACHE_KEY
        );
        return entries ?? [];
    } catch (error) {
        console.error('Korean name store load failed:', error);
        return [];
    }
}

export async function searchByKoreanName(
    query: string
): Promise<TickerSearchResult[]> {
    const entries = await loadAllEntries();
    const normalizedQuery = query.toLowerCase();
    return entries
        .filter(entry =>
            entry.koreanName.toLowerCase().includes(normalizedQuery)
        )
        .map(koreanEntryToSearchResult);
}

export async function getKoreanNames(
    symbols: string[]
): Promise<Partial<Record<string, string>>> {
    if (symbols.length === 0) return {};

    const entries = await loadAllEntries();
    const symbolMap = new Map(entries.map(e => [e.symbol, e.koreanName]));

    return symbols.reduce<Record<string, string>>((acc, symbol) => {
        const koreanName = symbolMap.get(symbol);
        if (!koreanName) return acc;
        return { ...acc, [symbol]: koreanName };
    }, {});
}

export async function setKoreanTickers(
    newEntries: KoreanTickerEntry[]
): Promise<void> {
    if (newEntries.length === 0) return;

    const cache = createCacheProvider();
    if (!cache) return;

    try {
        const existing =
            (await cache.get<KoreanTickerEntry[]>(KOREAN_TICKERS_CACHE_KEY)) ??
            [];
        const newSymbols = new Set(newEntries.map(e => e.symbol));
        const merged = [
            ...existing.filter(e => !newSymbols.has(e.symbol)),
            ...newEntries,
        ];
        await cache.set(
            KOREAN_TICKERS_CACHE_KEY,
            merged,
            KOREAN_NAMES_CACHE_TTL
        );
    } catch (error) {
        console.error('Korean name store setKoreanTickers failed:', error);
    }
}
