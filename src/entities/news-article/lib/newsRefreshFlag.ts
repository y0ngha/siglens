import 'server-only';
import { createRedisFlag } from '@/shared/cache/createRedisFlag';
import { SECONDS_PER_MINUTE } from '@/shared/config/time';

const NEWS_REFRESH_FLAG_TTL_MINUTES = 10;

/** 뉴스 refresh 플래그 TTL — 이 시간 내 재크롤링(봇)은 FMP fetch+upsert를 스킵. */
export const NEWS_REFRESH_FLAG_TTL_SECONDS =
    NEWS_REFRESH_FLAG_TTL_MINUTES * SECONDS_PER_MINUTE;

const _flag = createRedisFlag(
    (symbol: string) => `news:refresh:${symbol.toUpperCase()}`,
    NEWS_REFRESH_FLAG_TTL_SECONDS,
    '[newsRefreshFlag]'
);

/** 최근(TTL 내) 이 symbol의 뉴스를 fetch했는지. Redis 미설정/장애 시 false(=항상 fetch). */
export const isRecentlyFetched = _flag.isSet;

/** 이 symbol을 "최근 fetch함"으로 표시. Redis 미설정/장애 시 noop. */
export const markFetched = _flag.mark;
