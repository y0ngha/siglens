import { NeonDbError } from '@neondatabase/serverless';
import type { WithRetryOptions } from '@/infrastructure/utils/withRetry';

/**
 * Single source of truth for transient SQLSTATE codes — Neon connection-
 * lifecycle and capacity-exhaustion classes. Adding a new code here
 * propagates to both the `.code` field check and the message-substring
 * fallback automatically; previous duplicate literal lists caused silent
 * divergence when only one half was updated.
 *
 *   - 57P01: admin_shutdown (Neon scales pooler down mid-request)
 *   - 08006: connection_failure
 *   - 08003: connection_does_not_exist
 *   - 08001: sqlclient_unable_to_establish_sqlconnection
 *   - 08004: sqlserver_rejected_establishment_of_sqlconnection
 *   - 53300: too_many_connections (transient cap; safe to retry with backoff)
 */
const TRANSIENT_SQLSTATE_CODES = [
    '57P01',
    '08006',
    '08003',
    '08001',
    '08004',
    '53300',
] as const;

/**
 * Connection-lifecycle substrings the Neon HTTP driver embeds in failure
 * messages. SQLSTATE codes are NOT bare-substring matched here — that would
 * false-positive on user data values that happen to contain the same digits.
 * See `TRANSIENT_SQLSTATE_REGEX` below for word-boundary matching.
 *
 * Examples seen in production:
 *   "Error connecting to database: TypeError: fetch failed"
 */
const TRANSIENT_MESSAGE_NEEDLES = [
    'Error connecting to database',
    'fetch failed',
] as const;

/**
 * SQLSTATE codes matched against the error message with word boundaries —
 * this catches Postgres errors that embed the code inline (e.g.
 * "terminating connection (code 57P01)") without false-positives on user
 * data / identifiers that happen to contain the same digit sequence
 * ("user_57P01ABC", "pk_constraint_53300_check", etc.).
 *
 * The `.code` field check (`codeLooksTransient`) remains the primary path —
 * this regex is only the fallback when `NeonDbError.code` is undefined.
 */
const TRANSIENT_SQLSTATE_REGEX = new RegExp(
    `\\b(${TRANSIENT_SQLSTATE_CODES.join('|')})\\b`
);

/**
 * SQLSTATE codes treated as transient when surfaced on `NeonDbError.code`
 * (the typed field). NeonDbError exposes `code?: string` for server-side
 * errors; checking it directly avoids dependency on message formatting.
 */
const TRANSIENT_SQLSTATES = new Set<string>(TRANSIENT_SQLSTATE_CODES);

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
    if (
        TRANSIENT_MESSAGE_NEEDLES.some(needle => error.message.includes(needle))
    ) {
        return true;
    }
    return TRANSIENT_SQLSTATE_REGEX.test(error.message);
}

function codeLooksTransient(error: Error): boolean {
    // Safe-cast 근거: NeonDbError 는 Error를 확장하면서 optional `code: string`을
    // 노출한다(@neondatabase/serverless type 정의). 그러나 본 함수는 NeonDbError 인지
    // 미확정 상태에서도 호출될 수 있으므로 정적 타입을 `code?: unknown` 으로 일단
    // 넓힌 뒤 바로 아래에서 `typeof code === 'string'` 으로 좁힌다 — 런타임에
    // code 가 없거나 비-문자열이면 false 로 떨어져 안전하다.
    const code = (error as Error & { code?: unknown }).code;
    return typeof code === 'string' && TRANSIENT_SQLSTATES.has(code);
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
        if (
            isNeonError(current) &&
            (messageLooksTransient(current) || codeLooksTransient(current))
        ) {
            return true;
        }
        current = current.cause;
    }
    return false;
}

/**
 * Shared retry policy for Neon HTTP driver write paths. Three retries with
 * 200/400/800ms exponential backoff + jitter absorb the typical transient
 * `fetch failed` window while staying well inside serverless-function budgets.
 *
 * `backoffBudgetMs: 5000` caps the cumulative backoff sleep budget — if
 * `fn()` itself runs slow and the elapsed time approaches 5s, withRetry
 * bails out rather than queueing more sleeps. Maximum sleep cap is ~2.8s
 * (200+400+800 + up to 1× jitter), so this budget covers the worst case
 * comfortably while leaving headroom inside Vercel serverless 10s function
 * limits.
 *
 * Import this constant from every `*Repository.upsert*` site so the retry
 * behavior stays uniform across repositories.
 */
export const NEON_TRANSIENT_RETRY: WithRetryOptions = {
    maxRetries: 3,
    baseDelayMs: 200,
    isRetryable: isNeonTransientError,
    backoffBudgetMs: 5000,
};
