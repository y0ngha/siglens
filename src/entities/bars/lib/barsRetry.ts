import type { WithRetryOptions } from '@/shared/lib/withRetry';
import { getFmpRateLimitRetryDelayMs } from '@/shared/api/fmp/fmpRetry';
import { getFmpErrorStatus } from '@/shared/api/fmp/fmpUserMessage';

export function isCoreFmpTransientError(error: unknown): boolean {
    const status = getFmpErrorStatus(error);
    if (status !== null) return status === 429 || status >= 500;

    return error instanceof TypeError || error instanceof DOMException;
}

export function getCoreFmpRetryDelayMs(
    error: unknown,
    attempt: number
): number | null {
    return getFmpErrorStatus(error) === 429
        ? getFmpRateLimitRetryDelayMs(attempt)
        : null;
}

export const BARS_FMP_RETRY: WithRetryOptions = {
    maxRetries: 3,
    baseDelayMs: 500,
    backoffBudgetMs: 60_000,
    isRetryable: isCoreFmpTransientError,
    getRetryDelayMs: getCoreFmpRetryDelayMs,
};
