import { sleep } from '@/lib/sleep';

/**
 * Options for {@link withRetry}.
 *
 * `maxRetries` is the number of retries *after* the initial attempt, so the
 * total number of `fn` invocations is `maxRetries + 1`.
 *
 * Backoff schedule (proportional jitter):
 *   attempt 0 fails → wait `baseDelayMs * 2^0 + random(0, baseDelayMs * 2^0)`
 *   attempt 1 fails → wait `baseDelayMs * 2^1 + random(0, baseDelayMs * 2^1)`
 *   …
 * Jitter prevents synchronized retry storms when many concurrent callers fail
 * against the same upstream.
 */
export interface WithRetryOptions {
    /** Retries after the initial call. Total calls = maxRetries + 1. */
    maxRetries: number;
    /** Base delay; doubled per retry, plus proportional jitter. */
    baseDelayMs: number;
    /**
     * Decide whether a thrown error is transient and worth retrying. Non-
     * retryable errors (schema violations, permission errors, etc.) are
     * re-thrown immediately so callers see the real failure without delay.
     */
    isRetryable: (error: unknown) => boolean;
    /**
     * Overall budget across `fn` invocations + backoff sleeps combined,
     * measured from the first attempt. When the next backoff sleep would push
     * elapsed time past the deadline, `withRetry` bails out and re-throws the
     * most recent error rather than waiting. Note this does NOT abort an
     * in-flight `fn()` — a hanging call still blocks until it settles. Omit
     * to disable the cap (legacy behavior).
     */
    totalTimeoutMs?: number;
}

/**
 * Run `fn`, retrying on transient errors with exponential backoff + jitter.
 *
 * The factory shape (`() => Promise<T>`) is required so each retry creates a
 * fresh promise — passing an already-started `Promise<T>` would just await the
 * same settled result on every "retry."
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: WithRetryOptions
): Promise<T> {
    const { maxRetries, baseDelayMs, isRetryable, totalTimeoutMs } = options;
    const deadline =
        totalTimeoutMs !== undefined ? Date.now() + totalTimeoutMs : Infinity;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            const isLastAttempt = attempt === maxRetries;
            if (isLastAttempt || !isRetryable(error)) {
                throw error;
            }
            const exponential = baseDelayMs * 2 ** attempt;
            const jitter = Math.random() * exponential;
            const sleepMs = exponential + jitter;
            // 다음 backoff sleep을 마치는 시점이 deadline을 넘어서면 더 기다리지
            // 않고 즉시 마지막 에러를 던진다. fn() 자체의 진행 중인 호출은 멈출
            // 수 없지만, 적어도 retry sleep 으로 인한 추가 지연이 예상 예산을
            // 초과하는 일은 막는다.
            if (Date.now() + sleepMs >= deadline) {
                throw error;
            }
            await sleep(sleepMs);
        }
    }
    // Genuinely unreachable: every iteration either returns or throws. TS
    // cannot prove that from `attempt <= maxRetries` alone, so removing this
    // statement triggers TS2366 ("Function lacks ending return statement"). Do
    // not delete.
    throw new Error('withRetry: unreachable');
}
