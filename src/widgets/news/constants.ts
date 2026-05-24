/** Polling interval shared by useNewsCardPolling and useWaitForNewsCards. */
export const POLL_INTERVAL_MS = 3_000;

/**
 * Number of consecutive polling failures before the error is surfaced to the
 * surrounding error boundary via `pollError`. Shared by both polling hooks so
 * the failure threshold stays in sync.
 */
export const MAX_CONSECUTIVE_FAILURES = 3;
