import { readFmpConfig } from '@y0ngha/siglens-core';

/** Base URL for all FMP `/stable/*` endpoints. */
export const FMP_STABLE_BASE = 'https://financialmodelingprep.com/stable';

/** Timeout for all FMP fetch calls (ms). */
const FMP_FETCH_TIMEOUT_MS = 10_000;

/** GET FMP /stable/<path>; appends apikey automatically; throws if FMP_API_KEY missing or non-2xx response. */
export async function fmpGet<T>(
    path: string,
    query: Record<string, string> = {}
): Promise<T> {
    const { apiKey } = readFmpConfig();
    const params = new URLSearchParams({ ...query, apikey: apiKey });
    const res = await fetch(`${FMP_STABLE_BASE}/${path}?${params.toString()}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(FMP_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
        throw new Error(`FMP ${path} ${res.status}`);
    }
    // Adapter methods narrow the result via explicit field mapping; malformation surfaces as TypeError in the mapper.
    return (await res.json()) as T;
}
