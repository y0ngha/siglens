/**
 * `useMarketNewsCardPolling` / `useWaitForMarketNewsCards`가 쓰는 카드 폴링 상수.
 * 값은 `shared/config/cardPollingConfig`가 단일 출처다 — news 슬라이스와 동일해야 한다.
 */
export {
    POLL_INTERVAL_MS,
    MAX_CONSECUTIVE_FAILURES,
    EMPTY_SNAPSHOT_MAX_POLLS,
    MAX_POLL_DURATION_MS,
} from '@/shared/config/cardPollingConfig';
