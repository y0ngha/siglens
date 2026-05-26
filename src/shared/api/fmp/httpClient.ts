import { readFmpConfig } from '@y0ngha/siglens-core';
import { withRetry } from '@/shared/lib/withRetry';
import { FmpHttpError } from './FmpHttpError';
import { FMP_TRANSIENT_RETRY } from './fmpRetry';

/** Base URL for all FMP `/stable/*` endpoints. */
export const FMP_STABLE_BASE = 'https://financialmodelingprep.com/stable';

/** Timeout for all FMP fetch calls (ms). */
const FMP_FETCH_TIMEOUT_MS = 10_000;

/**
 * Parse the `Retry-After` response header value (seconds as integer).
 * Returns null if the header is absent, non-numeric, zero, or negative.
 */
function parseRetryAfterSeconds(header: string | null): number | null {
    if (header === null) return null;
    const seconds = Number(header);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

/**
 * GET FMP /stable/<path>; appends apikey automatically.
 *
 * Transient errors (429, 5xx, network failures, timeouts) are retried up to 3
 * times with exponential backoff. Non-transient 4xx errors are thrown
 * immediately as `FmpHttpError`. `readFmpConfig()` and `URLSearchParams` run
 * once per call — only `fetch()` is inside the retry loop so each attempt gets
 * a fresh `AbortSignal` timeout.
 */
export async function fmpGet<T>(
    path: string,
    query: Record<string, string> = {}
): Promise<T> {
    const { apiKey } = readFmpConfig();
    const params = new URLSearchParams({ ...query, apikey: apiKey });

    return withRetry(async () => {
        const res = await fetch(
            `${FMP_STABLE_BASE}/${path}?${params.toString()}`,
            {
                cache: 'no-store',
                signal: AbortSignal.timeout(FMP_FETCH_TIMEOUT_MS),
            }
        );
        if (!res.ok) {
            const retryAfter = parseRetryAfterSeconds(
                res.headers.get('Retry-After')
            );
            throw new FmpHttpError(path, res.status, retryAfter);
        }
        // Malformation surfaces as TypeError in the adapter mapper, not silently.
        return (await res.json()) as T;
    }, FMP_TRANSIENT_RETRY);
}
