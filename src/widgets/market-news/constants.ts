/**
 * Re-export card-polling constants from the shared config so both
 * useMarketNewsCardPolling and useWaitForMarketNewsCards share identical
 * thresholds without reaching into another widget slice.
 */
export {
    NEWS_CARD_POLL_INTERVAL_MS as POLL_INTERVAL_MS,
    NEWS_CARD_MAX_CONSECUTIVE_FAILURES as MAX_CONSECUTIVE_FAILURES,
    NEWS_CARD_EMPTY_SNAPSHOT_MAX_POLLS as EMPTY_SNAPSHOT_MAX_POLLS,
    NEWS_CARD_MAX_POLL_DURATION_MS as MAX_POLL_DURATION_MS,
} from '@/shared/config/pollingConfig';
