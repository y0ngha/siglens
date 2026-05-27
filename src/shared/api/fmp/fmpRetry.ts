import type { WithRetryOptions } from '@/shared/lib/withRetry';
import { MS_PER_SECOND } from '@/shared/config/time';
import { FmpHttpError } from '@/shared/api/fmp/FmpHttpError';

export const FMP_RATE_LIMIT_RETRY_DELAYS_MS = [10_000, 15_000, 20_000] as const;

/**
 * True for transient HTTP errors worth retrying:
 *   - FmpHttpError with status 429 (rate-limited) or >= 500 (server error)
 *   - TypeError (network-level fetch failure, e.g. DNS / TCP timeout)
 *   - DOMException (AbortError from request timeout)
 *
 * False for all other cases, including 4xx client errors (400, 401, 403, 404)
 * that indicate a permanent caller-side problem and should not be retried.
 */
export function isFmpTransientError(error: unknown): boolean {
    if (error instanceof FmpHttpError) {
        return error.status === 429 || error.status >= 500;
    }
    return error instanceof TypeError || error instanceof DOMException;
}

/**
 * Extract a server-suggested retry delay from an FmpHttpError's
 * `retryAfterSeconds` field (converted to milliseconds). Returns `null` for
 * any other error type or when `retryAfterSeconds` is null, falling back to
 * the normal exponential+jitter schedule in `withRetry`.
 */
export function extractRetryAfterMs(error: unknown): number | null {
    if (error instanceof FmpHttpError && error.retryAfterSeconds !== null) {
        return error.retryAfterSeconds * MS_PER_SECOND;
    }
    return null;
}

export function getFmpRateLimitRetryDelayMs(attempt: number): number | null {
    return FMP_RATE_LIMIT_RETRY_DELAYS_MS[attempt] ?? null;
}

export function getFmpRetryDelayMs(
    error: unknown,
    attempt: number
): number | null {
    const retryAfterMs = extractRetryAfterMs(error);
    if (retryAfterMs !== null) return retryAfterMs;

    if (error instanceof FmpHttpError && error.status === 429) {
        return getFmpRateLimitRetryDelayMs(attempt);
    }

    return null;
}

/**
 * Shared retry policy for FMP HTTP client transient errors. Exponential
 * backoff + jitter handles intermittent server/network errors. 429 responses
 * wait 10s → 15s → 20s by default, while `Retry-After` still takes priority
 * when FMP sends it via `FmpHttpError.retryAfterSeconds`.
 */
export const FMP_TRANSIENT_RETRY: WithRetryOptions = {
    maxRetries: 3,
    baseDelayMs: 500,
    isRetryable: isFmpTransientError,
    backoffBudgetMs: 60_000,
    getRetryDelayMs: getFmpRetryDelayMs,
};
