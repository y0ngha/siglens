/**
 * Shared FMP HTTP helper used by all FMP infrastructure clients.
 *
 * Centralises the `readFmpConfig` call and `fetch` logic so that
 * `fundamentalClient.ts` and `newsClient.ts` do not duplicate the same code.
 */
import { readFmpConfig } from '@y0ngha/siglens-core';

/** Base URL for all FMP `/stable/*` endpoints. */
export const FMP_STABLE_BASE = 'https://financialmodelingprep.com/stable';

/** @internal Timeout for all FMP fetch calls (ms). */
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
    // FMP API responses are trusted to match the caller-provided T shape.
    // Each adapter method (FmpFundamentalClient.*, FmpNewsClient.*) is responsible
    // for type-narrowing the result via explicit field mapping before passing
    // it across the layer boundary. Runtime malformation surfaces as a TypeError
    // in the calling mapper rather than silent corruption.
    return (await res.json()) as T;
}
