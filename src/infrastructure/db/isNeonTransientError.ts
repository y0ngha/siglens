import { NeonDbError } from '@neondatabase/serverless';
import type { WithRetryOptions } from '@/lib/withRetry';

/**
 * Substrings that indicate a Neon HTTP driver connection / network failure
 * rather than a permanent SQL-level error (schema, constraint, permission).
 *
 * Examples seen in production:
 *   "Error connecting to database: TypeError: fetch failed"
 *   "Error connecting to database: …"
 *
 * Permanent errors (constraint violations, undefined column, etc.) carry
 * different messages and are NOT matched here, so callers won't burn retries
 * on something that will fail identically next time.
 */
const TRANSIENT_MESSAGE_NEEDLES = [
    'Error connecting to database',
    'fetch failed',
] as const;

/**
 * Upper bound on how many `cause` links we follow before giving up. Drizzle
 * wraps a Neon error in at most one outer Error, so 8 is well past anything
 * we'd see in practice; the limit exists purely to terminate pathological
 * self-referential causes.
 */
const MAX_CAUSE_DEPTH = 8;

function isNeonError(value: unknown): value is Error {
    // `instanceof` is the primary signal, but we also accept any Error whose
    // `name` is `"NeonDbError"` to survive dual-module-instance scenarios where
    // the imported class identity drifts from the thrown instance's class.
    return (
        value instanceof NeonDbError ||
        (value instanceof Error && value.name === 'NeonDbError')
    );
}

function messageLooksTransient(error: Error): boolean {
    return TRANSIENT_MESSAGE_NEEDLES.some(needle =>
        error.message.includes(needle)
    );
}

/**
 * Walk the `cause` chain looking for a transient Neon HTTP driver error.
 * Drizzle wraps Neon errors in a generic `Failed query: …` Error and stashes
 * the real `NeonDbError` under `cause`, so a shallow check on the outer error
 * misses every real transient failure in this codebase.
 */
export function isNeonTransientError(error: unknown): boolean {
    let current: unknown = error;
    for (
        let depth = 0;
        depth < MAX_CAUSE_DEPTH && current instanceof Error;
        depth++
    ) {
        if (isNeonError(current) && messageLooksTransient(current)) {
            return true;
        }
        current = (current as { cause?: unknown }).cause;
    }
    return false;
}

/**
 * Shared retry policy for Neon HTTP driver write paths. Three retries with
 * 200/400/800ms exponential backoff + jitter absorb the typical transient
 * `fetch failed` window while staying well inside serverless-function budgets.
 *
 * Import this constant from every `*Repository.upsert*` site so the retry
 * behavior stays uniform across repositories.
 */
export const NEON_TRANSIENT_RETRY: Pick<
    WithRetryOptions,
    'maxRetries' | 'baseDelayMs' | 'isRetryable'
> = {
    maxRetries: 3,
    baseDelayMs: 200,
    isRetryable: isNeonTransientError,
};
