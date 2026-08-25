/**
 * `useMarketNewsCardPolling` / `useWaitForMarketNewsCards`가 쓰는 카드 폴링 상수.
 * 값은 `shared/config/cardPollingConfig`가 단일 출처다 — news 슬라이스와 동일해야 한다.
 */
export {
    POLL_INTERVAL_MS,
    MAX_CONSECUTIVE_FAILURES,
    EMPTY_SNAPSHOT_MAX_POLLS,
    MAX_POLL_DURATION_MS,
    STAGNANT_POLL_LIMIT,
    STAGNATION_FLOOR_POLLS,
} from '@/shared/config/cardPollingConfig';

/**
 * 카테고리 뉴스도 종목 뉴스와 같은 상한을 쓴다 — 근거는
 * `shared/config/newsSerialization` 주석. 이름만 슬라이스 로컬로 노출한다.
 */
export { NEWS_ROW_SERIALIZATION_LIMIT as MARKET_NEWS_ROW_SERIALIZATION_LIMIT } from '@/shared/config/newsSerialization';

/**
 * `MarketNewsList`(렌더)와 `/news/[category]` 페이지(JSON-LD)가 공유하는
 * 페이지 크기 — 근거는 `shared/config/newsSerialization`의
 * `MARKET_NEWS_LIST_PAGE_SIZE` 주석.
 */
export { MARKET_NEWS_LIST_PAGE_SIZE } from '@/shared/config/newsSerialization';
