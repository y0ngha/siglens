import 'server-only';
import { createRedisFlag } from '@/shared/cache/createRedisFlag';
import {
    CALENDAR_REFRESH_FLAG_KEY,
    CALENDAR_REFRESH_FLAG_TTL_SECONDS,
} from '../lib/economyCalendarConstants';

const _flag = createRedisFlag(
    CALENDAR_REFRESH_FLAG_KEY,
    CALENDAR_REFRESH_FLAG_TTL_SECONDS,
    '[calendarRefreshFlag]'
);

/** 최근 TTL 내 fetch 여부 — Redis 실패 시 false(항상 fetch). market-news 미러. */
export const isCalendarRecentlyFetched = _flag.isSet;

/** "최근 fetch함" 마킹 — Redis 실패 시 noop. */
export const markCalendarFetched = _flag.mark;
