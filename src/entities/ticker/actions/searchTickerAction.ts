'use server';

import { waitUntil } from '@vercel/functions';
import { searchTicker } from '../lib/searchTicker';
import type { TickerSearchResult } from '@/shared/lib/types';

/**
 * Deterministic AAPL-family fixture returned under E2E_TEST so the ticker
 * autocomplete renders real options without a live FMP call (CI has no
 * FMP_API_KEY). Mirrors the E2E short-circuit pattern used by the data-provider
 * factories (getMarketDataProvider, getFundamentalDataProvider, etc.).
 */
const E2E_TICKER_FIXTURE: ReadonlyArray<TickerSearchResult> = [
    {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        exchange: 'NASDAQ',
        exchangeFullName: 'NASDAQ Global Select',
        koreanName: '애플',
    },
    {
        symbol: 'AAPU',
        name: 'Direxion Daily AAPL Bull 2X Shares',
        exchange: 'NASDAQ',
        exchangeFullName: 'NASDAQ Global Market',
    },
    {
        symbol: 'AAPD',
        name: 'Direxion Daily AAPL Bear 1X Shares',
        exchange: 'NASDAQ',
        exchangeFullName: 'NASDAQ Global Market',
    },
];

export async function searchTickerAction(
    query: string
): Promise<TickerSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    if (process.env.E2E_TEST === '1') {
        // Hermetic E2E path: never touch FMP. Filter the fixture by the typed
        // query (symbol or name, case-insensitive); fall back to the full
        // AAPL-family set so the listbox is never empty.
        const needle = trimmed.toLowerCase();
        const matches = E2E_TICKER_FIXTURE.filter(
            t =>
                t.symbol.toLowerCase().includes(needle) ||
                t.name.toLowerCase().includes(needle)
        );
        return matches.length > 0 ? matches : [...E2E_TICKER_FIXTURE];
    }

    return searchTicker(trimmed, { waitUntil });
}
