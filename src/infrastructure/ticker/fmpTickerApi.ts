import type { TickerSearchResult } from '@/domain/types';
import type { FmpSearchResult } from '@/infrastructure/ticker/types';

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
        // TypeScript: readonly tuple의 .includes()는 정확한 literal 타입만 허용하므로 string으로 단언
        (US_EXCHANGES as readonly string[]).includes(r.exchange)
    );
}

// FMP는 지수 심볼에 ^ 접두사를 붙여 반환한다 (예: ^SPX, ^DJI)
export function filterIndexResults(
    results: FmpSearchResult[]
): FmpSearchResult[] {
    return results.filter(r => r.symbol.startsWith('^'));
}

// ^ 접두사를 제거하여 URL/표시용 심볼로 변환한다 (예: ^SPX → SPX)
export function toDisplaySymbol(fmpSymbol: string): string {
    return fmpSymbol.startsWith('^') ? fmpSymbol.slice(1) : fmpSymbol;
}

async function fetchFmpEndpoint(
    endpoint: 'search-symbol' | 'search-name',
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

    const url = `${FMP_BASE_URL}/${endpoint}?${params}`;

    try {
        const res = await fetch(url);
        if (!res.ok) {
            console.error(
                `FMP ${endpoint} error: ${res.status} ${res.statusText}`
            );
            return [];
        }
        // fetch response 전체 스키마 타입 가드는 불가 — FMP API 계약에 의해 단언
        const raw = (await res.json()) as FmpSearchResult[];
        if (!Array.isArray(raw)) return [];
        return raw;
    } catch (error) {
        console.error(`FMP ${endpoint} fetch failed:`, error);
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
