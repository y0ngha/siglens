import { MS_PER_SECOND } from '@/domain/constants/time';
import { tryReadFmpConfig } from '@y0ngha/siglens-core';
import type { TickerSearchResult } from '@/domain/types';
import type { FmpSearchResult } from '@/infrastructure/ticker/types';

const FMP_BASE_URL = 'https://financialmodelingprep.com/stable';
const FMP_SEARCH_LIMIT = 20;
const FMP_FETCH_TIMEOUT_MS = MS_PER_SECOND * 10;
const US_EXCHANGES: ReadonlySet<string> = new Set([
    'NYSE',
    'NASDAQ',
    'AMEX',
    'NYSEArca',
]);

type FmpEndpoint = 'search-symbol' | 'search-name';

export function toTickerSearchResult(fmp: FmpSearchResult): TickerSearchResult {
    return {
        symbol: fmp.symbol,
        name: fmp.name,
        exchange: fmp.exchange,
        exchangeFullName: fmp.exchangeFullName,
    };
}

export function filterUsExchanges(
    results: FmpSearchResult[]
): FmpSearchResult[] {
    return results.filter(r => US_EXCHANGES.has(r.exchange));
}

async function fetchFmpEndpoint(
    endpoint: FmpEndpoint,
    query: string
): Promise<FmpSearchResult[]> {
    const config = tryReadFmpConfig();
    if (!config) return [];

    const params = new URLSearchParams({
        query,
        limit: String(FMP_SEARCH_LIMIT),
        apikey: config.apiKey,
    });

    const url = `${FMP_BASE_URL}/${endpoint}?${params}`;

    try {
        const res = await fetch(url, {
            signal: AbortSignal.timeout(FMP_FETCH_TIMEOUT_MS),
        });
        if (!res.ok) return [];
        const raw: unknown = await res.json();
        // FMP search endpoints return a JSON array of records matching FmpSearchResult.
        // We verify array shape via Array.isArray; per-element shape is not validated at
        // runtime — caller-side `filterUsExchanges` and `toTickerSearchResult` rely on
        // FMP's documented response contract. Cast scope is limited to this boundary.
        return Array.isArray(raw) ? (raw as FmpSearchResult[]) : [];
    } catch {
        return [];
    }
}

export async function searchBySymbol(
    query: string
): Promise<FmpSearchResult[]> {
    return fetchFmpEndpoint('search-symbol', query);
}

export async function searchByName(query: string): Promise<FmpSearchResult[]> {
    return fetchFmpEndpoint('search-name', query);
}
