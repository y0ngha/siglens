import type { WithRetryOptions } from '@/shared/lib/withRetry';
import { FmpHttpError } from './FmpHttpError';

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
        return error.retryAfterSeconds * 1000;
    }
    return null;
}

/**
 * Shared retry policy for FMP HTTP client transient errors. Three retries with
 * 500/1000/2000ms exponential backoff + jitter handle rate-limit windows and
 * intermittent server errors while staying within serverless-function budgets.
 *
 * `backoffBudgetMs: 8000` caps cumulative backoff sleep — if the function
 * itself runs slow and approaches the budget, `withRetry` bails out rather
 * than queueing more sleeps. `getRetryDelayMs` honors any `Retry-After`
 * header value the FMP API returns via `FmpHttpError.retryAfterSeconds`.
 */
export const FMP_TRANSIENT_RETRY: WithRetryOptions = {
    maxRetries: 3,
    baseDelayMs: 500,
    isRetryable: isFmpTransientError,
    backoffBudgetMs: 8000,
    getRetryDelayMs: extractRetryAfterMs,
};
