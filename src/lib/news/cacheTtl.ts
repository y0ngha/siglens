import {
    SECONDS_PER_DAY,
    SECONDS_PER_HOUR,
    SECONDS_PER_MINUTE,
} from '@/domain/constants/time';

/** T1: 15 minutes — news list snapshot. */
export const NEWS_LIST_TTL_S = 15 * SECONDS_PER_MINUTE;

/** T2: 12 hours — analyst grade events. */
export const NEWS_GRADES_TTL_S = 12 * SECONDS_PER_HOUR;

/** T3: 7 days — broad earnings calendar sync data. */
export const NEWS_EARNINGS_CALENDAR_TTL_S = 7 * SECONDS_PER_DAY;

/** T4: 24 hours — per-symbol earnings report fetch-through cache. */
export const NEWS_EARNINGS_REPORT_TTL_S = SECONDS_PER_DAY;
