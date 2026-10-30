import 'server-only';
import { createRedisFlag } from '@/shared/cache/createRedisFlag';
import { SECONDS_PER_HOUR, SECONDS_PER_MINUTE } from '@/shared/config/time';

const MARKET_NEWS_REFRESH_FLAG_TTL_MINUTES = 10;

/**
 * 방문자 경로의 새로고침 플래그 TTL — 이 창 안에 다시 크롤하는 봇은 FMP fetch + upsert를
 * 건너뛰어 불필요한 외부 호출을 피한다. `news-article`의 `newsRefreshFlag`와 같은
 * 구조이고 센티널 심볼로 키를 잡아 슬라이스를 분리한다.
 */
export const MARKET_NEWS_REFRESH_FLAG_TTL_SECONDS =
    MARKET_NEWS_REFRESH_FLAG_TTL_MINUTES * SECONDS_PER_MINUTE;

const marketNewsRefreshFlag = createRedisFlag(
    (sentinel: string) => `market-news:refresh:${sentinel}`,
    MARKET_NEWS_REFRESH_FLAG_TTL_SECONDS,
    '[marketNewsRefreshFlag]'
);

/** 이 센티널 버킷이 TTL 안에 적재됐으면 true. Redis 장애 → false(항상 적재). */
export const isRecentlyFetched = marketNewsRefreshFlag.isSet;

/** 이 센티널 버킷을 "방금 적재함"으로 표시한다. Redis 장애 → noop. */
export const markFetched = marketNewsRefreshFlag.mark;

/**
 * 허브 프리웜 크론의 카테고리 적재 간격(3시간).
 *
 * 방문자 경로의 10분 플래그와 따로 둔다. 크론은 5분마다 돌고, 적재로 새 기사가
 * 들어오면 다이제스트의 core 캐시 키(입력 기사 목록에서 파생)가 바뀌어 **다이제스트
 * LLM이 다시 돈다.** 10분 간격 그대로면 밤사이 카테고리당 수십 번
 * 재생성될 수 있다. 카테고리 페이지 ISR이 12시간이라 3시간이면 신선도는 충분하고,
 * 다이제스트 재생성도 카테고리당 하룻밤 몇 번으로 묶인다.
 */
export const MARKET_NEWS_CRON_INGEST_INTERVAL_SECONDS = 3 * SECONDS_PER_HOUR;

const marketNewsCronIngestFlag = createRedisFlag(
    (sentinel: string) => `market-news:cron-ingest:${sentinel}`,
    MARKET_NEWS_CRON_INGEST_INTERVAL_SECONDS,
    '[marketNewsCronIngestFlag]'
);

/** 크론이 이 버킷을 간격 안에 이미 적재했으면 true. Redis 장애 → false(적재 시도). */
export const isCronIngestedRecently = marketNewsCronIngestFlag.isSet;

/** 크론 적재 완료 표시. Redis 장애 → noop. */
export const markCronIngested = marketNewsCronIngestFlag.mark;
