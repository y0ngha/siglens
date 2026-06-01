import { MS_PER_SECOND } from '@/shared/config/time';
import type { TickerSearchResult } from '@/shared/lib/types';
import { tryReadFmpConfig } from '@y0ngha/siglens-core';
import type { FmpSearchResult } from '../model';

const FMP_BASE_URL = 'https://financialmodelingprep.com/stable';
const FMP_SEARCH_LIMIT = 20;
const FMP_FETCH_TIMEOUT_MS = MS_PER_SECOND * 10;
const US_EXCHANGES: ReadonlySet<string> = new Set([
    'NYSE',
    'NASDAQ',
    'AMEX',
    'CBOE',
    'OTC',
    'PNK',
]);

type FmpEndpoint = 'search-symbol' | 'search-name';

/** getAssetInfo가 쓰는 throwOnInfraFailure(인프라 에러 throw) vs 검색 UI 기본(빈 배열 degrade)을 가르는 옵션. */
interface FmpSearchOptions {
    throwOnInfraFailure?: boolean;
}

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
    query: string,
    options?: FmpSearchOptions
): Promise<FmpSearchResult[]> {
    const throwOnInfraFailure = options?.throwOnInfraFailure ?? false;

    const config = tryReadFmpConfig();
    if (!config) {
        // throwOnInfraFailure(getAssetInfo): 미설정은 인프라 문제 — null→404 캐싱을 막기 위해 throw.
        // 기본(검색 UI): 빈 결과로 degrade.
        if (throwOnInfraFailure)
            throw new Error('[fmpTickerApi] FMP config missing');
        return [];
    }

    const params = new URLSearchParams({
        query,
        limit: String(FMP_SEARCH_LIMIT),
        apikey: config.apiKey,
    });
    const url = `${FMP_BASE_URL}/${endpoint}?${params}`;

    let res: Response;
    try {
        res = await fetch(url, {
            signal: AbortSignal.timeout(FMP_FETCH_TIMEOUT_MS),
        });
    } catch (e) {
        if (throwOnInfraFailure)
            throw new Error(`[fmpTickerApi] ${endpoint} fetch failed`, {
                cause: e,
            });
        return [];
    }

    if (!res.ok) {
        if (throwOnInfraFailure)
            throw new Error(`[fmpTickerApi] ${endpoint} HTTP ${res.status}`);
        return [];
    }

    let raw: unknown;
    try {
        raw = await res.json();
    } catch (e) {
        if (throwOnInfraFailure)
            throw new Error(`[fmpTickerApi] ${endpoint} JSON parse failed`, {
                cause: e,
            });
        return [];
    }

    // 비배열 응답은 신뢰할 수 없는 형태 — throwOnInfraFailure면 throw해 no-match 오인/캐싱 방지.
    if (!Array.isArray(raw)) {
        if (throwOnInfraFailure)
            throw new Error(
                `[fmpTickerApi] ${endpoint} unexpected non-array response`
            );
        return [];
    }

    // FMP search endpoints return a JSON array of records matching FmpSearchResult.
    // We validate per-element shape with `toFmpSearchResults` so malformed rows
    // (missing required fields) are dropped before reaching downstream consumers
    // (`filterUsExchanges`, `toTickerSearchResult`).
    // 200 + 빈 배열은 정상적인 "매칭 없음"이므로 throwOnInfraFailure여도 throw하지 않는다.
    return toFmpSearchResults(raw);
}

export async function searchBySymbol(
    query: string,
    options?: FmpSearchOptions
): Promise<FmpSearchResult[]> {
    return fetchFmpEndpoint('search-symbol', query, options);
}

export async function searchByName(query: string): Promise<FmpSearchResult[]> {
    return fetchFmpEndpoint('search-name', query);
}
