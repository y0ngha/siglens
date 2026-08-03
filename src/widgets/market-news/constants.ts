/**
 * Card-polling constants used by useMarketNewsCardPolling and
 * useWaitForMarketNewsCards. Previously re-exported from shared/config/pollingConfig
 * which has been deleted as part of the worker-removal migration.
 */
export const POLL_INTERVAL_MS = 3_000;
export const MAX_CONSECUTIVE_FAILURES = 3;
export const EMPTY_SNAPSHOT_MAX_POLLS = 20;
export const MAX_POLL_DURATION_MS = 5 * 60_000;
