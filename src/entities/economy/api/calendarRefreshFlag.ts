import 'server-only';
import { createRedisFlag } from '@/shared/cache/createRedisFlag';
import {
    CALENDAR_REFRESH_FLAG_KEY,
    CALENDAR_REFRESH_FLAG_TTL_SECONDS,
    type CalendarCountry,
} from '../lib/economyCalendarConstants';

/**
 * 국가별 키. 하나의 전역 키를 쓰면 미국 인제스션이 마킹한 플래그 때문에 한국
 * 인제스션이 TTL 동안 통째로 건너뛴다 — 한국 캘린더가 조용히 비어 있게 된다.
 */
const _flag = createRedisFlag<CalendarCountry>(
    country => `${CALENDAR_REFRESH_FLAG_KEY}:${country.toLowerCase()}`,
    CALENDAR_REFRESH_FLAG_TTL_SECONDS,
    '[calendarRefreshFlag]'
);

/** 최근 TTL 내 fetch 여부 — Redis 실패 시 false(항상 fetch). market-news 미러. */
export const isCalendarRecentlyFetched = _flag.isSet;

/** "최근 fetch함" 마킹 — Redis 실패 시 noop. */
export const markCalendarFetched = _flag.mark;
