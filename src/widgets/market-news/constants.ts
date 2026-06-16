/**
 * Re-export polling constants from the per-symbol news widget so both
 * useMarketNewsCardPolling and useNewsCardPolling share identical thresholds.
 * Importing the underlying file directly (not the barrel) to avoid any future
 * barrel changes pulling in client-only directives into server build paths.
 */
export {
    POLL_INTERVAL_MS,
    MAX_CONSECUTIVE_FAILURES,
    EMPTY_SNAPSHOT_MAX_POLLS,
    MAX_POLL_DURATION_MS,
} from '@/widgets/news/hooks/useNewsCardPolling';
