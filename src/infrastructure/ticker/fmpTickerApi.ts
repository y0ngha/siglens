import type { TickerSearchResult } from '@/domain/types';
import type { FmpSearchResult } from './types';

const FMP_BASE_URL = 'https://financialmodelingprep.com/stable';
const FMP_SEARCH_LIMIT = 20;
const US_EXCHANGES = ['NYSE', 'NASDAQ', 'AMEX', 'NYSEArca'] as const;

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
    return results.filter(r =>
        (US_EXCHANGES as readonly string[]).includes(r.exchange)
    );
}

export async function searchBySymbol(
    query: string
): Promise<FmpSearchResult[]> {
    const apiKey = process.env.FMP_API_KEY;
    if (!apiKey) {
        console.error('FMP_API_KEY is not set');
        return [];
    }

    const params = new URLSearchParams({
        query,
        limit: String(FMP_SEARCH_LIMIT),
        apikey: apiKey,
    });

    const url = `${FMP_BASE_URL}/search-symbol?${params}`;

    try {
        const res = await fetch(url);
        if (!res.ok) {
            console.error(
                `FMP search-symbol error: ${res.status} ${res.statusText}`
            );
            return [];
        }
        const raw = (await res.json()) as FmpSearchResult[];
        if (!Array.isArray(raw)) return [];
        return raw;
    } catch (error) {
        console.error('FMP search-symbol fetch failed:', error);
        return [];
    }
}

export async function searchByName(query: string): Promise<FmpSearchResult[]> {
    const apiKey = process.env.FMP_API_KEY;
    if (!apiKey) {
        console.error('FMP_API_KEY is not set');
        return [];
    }

    const params = new URLSearchParams({
        query,
        limit: String(FMP_SEARCH_LIMIT),
        apikey: apiKey,
    });

    const url = `${FMP_BASE_URL}/search-name?${params}`;

    try {
        const res = await fetch(url);
        if (!res.ok) {
            console.error(
                `FMP search-name error: ${res.status} ${res.statusText}`
            );
            return [];
        }
        const raw = (await res.json()) as FmpSearchResult[];
        if (!Array.isArray(raw)) return [];
        return raw;
    } catch (error) {
        console.error('FMP search-name fetch failed:', error);
        return [];
    }
}
