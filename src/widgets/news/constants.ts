/**
 * 카드 폴링 상수 — 값은 `shared/config/cardPollingConfig`가 단일 출처다.
 * market-news 슬라이스와 동일한 값을 써야 해서 리터럴을 복제하지 않는다.
 */
export {
    POLL_INTERVAL_MS,
    MAX_CONSECUTIVE_FAILURES,
    EMPTY_SNAPSHOT_MAX_POLLS,
    MAX_POLL_DURATION_MS,
    STAGNANT_POLL_LIMIT,
    STAGNATION_FLOOR_POLLS,
} from '@/shared/config/cardPollingConfig';

// 상한 자체는 `shared/config/newsSerialization`이 단일 출처다 — 서버 렌더(widgets)와
// 폴링 액션(entities)이 같은 값을 써야 하는데 entities는 widgets를 import할 수 없다.
export { NEWS_ROW_SERIALIZATION_LIMIT } from '@/shared/config/newsSerialization';
