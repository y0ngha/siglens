import { MS_PER_SECOND } from '@/shared/config/time';
import { tryReadFmpConfig } from '@y0ngha/siglens-core';
import type { TickerSearchResult } from '@/shared/lib/types';
import type { FmpSearchResult } from '../model';

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

/** Type guard validating per-element FMP response shape before trusting it as `FmpSearchResult`. */
function isFmpSearchResultLike(value: unknown): value is FmpSearchResult {
    if (value === null || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    return (
        typeof v.symbol === 'string' &&
        typeof v.name === 'string' &&
        typeof v.currency === 'string' &&
        typeof v.exchange === 'string' &&
        typeof v.exchangeFullName === 'string'
    );
}

/** Filter raw FMP rows down to validated `FmpSearchResult` entries; logs and drops malformed rows. */
function toFmpSearchResults(raw: readonly unknown[]): FmpSearchResult[] {
    const valid = raw.filter(isFmpSearchResultLike);
    const dropped = raw.length - valid.length;
    if (dropped > 0) {
        console.warn(
            `[fmpTickerApi] dropped ${dropped} malformed FMP row(s) (missing required fields)`
        );
    }
    return valid;
}

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
        // We validate per-element shape with `toFmpSearchResults` so malformed rows
        // (missing required fields) are dropped before reaching downstream consumers
        // (`filterUsExchanges`, `toTickerSearchResult`).
        return Array.isArray(raw) ? toFmpSearchResults(raw) : [];
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
