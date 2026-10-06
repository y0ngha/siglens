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

/** 렌더 경로 FMP 시도 1회의 timeout(ms). `fmpGet`이 {@link FMP_RENDER_RETRY}와 함께 쓴다. */
export const FMP_RENDER_FETCH_TIMEOUT_MS = 3_000;

/**
 * 페이지 렌더 경로(`runWithRenderBudget` 안)의 FMP 재시도 정책. 배치용
 * {@link FMP_TRANSIENT_RETRY}와 판정(`isFmpTransientError`)·대기 계산
 * (`getFmpRetryDelayMs`)은 같고 **예산만 짧다**:
 *
 *  - 재시도 1회(총 2회 시도), 시도당 timeout {@link FMP_RENDER_FETCH_TIMEOUT_MS}.
 *  - 백오프 예산이 timeout과 같다. 첫 시도가 timeout까지 갔다면 예산이 이미 소진돼
 *    재시도 없이 바로 던진다. 빨리 실패한 경우(5xx 등)에만 짧게 쉬고 한 번 더 시도한다.
 *  - 429의 10/15/20초 대기나 그보다 긴 `Retry-After`는 예산을 넘으므로 기다리지 않고
 *    던진다. 렌더는 degrade하고, 레이트 리밋이 풀린 뒤 다음 재생성이 다시 채운다.
 *
 * 최악의 경우 한 호출이 약 3초 + 짧은 백오프 + 3초 안에 끝난다. 예전에는 같은 경로가
 * 45~70초를 붙잡을 수 있었다(`renderBudget.ts` 참고).
 */
export const FMP_RENDER_RETRY: WithRetryOptions = {
    maxRetries: 1,
    baseDelayMs: 250,
    isRetryable: isFmpTransientError,
    backoffBudgetMs: FMP_RENDER_FETCH_TIMEOUT_MS,
    getRetryDelayMs: getFmpRetryDelayMs,
};
