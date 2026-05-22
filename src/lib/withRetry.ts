import { sleep } from '@/lib/sleep';

/**
 * Options for {@link withRetry}.
 *
 * `maxRetries` is the number of retries *after* the initial attempt, so the
 * total number of `fn` invocations is `maxRetries + 1`.
 *
 * Backoff schedule (proportional jitter):
 *   attempt 0 fails → wait `baseDelayMs * 2^0 + random(0, baseDelayMs)`
 *   attempt 1 fails → wait `baseDelayMs * 2^1 + random(0, baseDelayMs)`
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
    const { maxRetries, baseDelayMs, isRetryable } = options;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            const isLastAttempt = attempt === maxRetries;
            if (isLastAttempt || !isRetryable(error)) {
                throw error;
            }
            const exponential = baseDelayMs * 2 ** attempt;
            const jitter = Math.random() * baseDelayMs;
            await sleep(exponential + jitter);
        }
    }
    // Genuinely unreachable: every iteration either returns or throws. TS
    // cannot prove that from `attempt <= maxRetries` alone, so removing this
    // statement triggers TS2366 ("Function lacks ending return statement"). Do
    // not delete.
    throw new Error('withRetry: unreachable');
}
