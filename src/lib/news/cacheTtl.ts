import { SECONDS_PER_HOUR, SECONDS_PER_MINUTE } from '@/shared/config/time';

/** T1: 15 minutes — news list snapshot. */
export const NEWS_LIST_TTL_S = 15 * SECONDS_PER_MINUTE;

/** T2: 12 hours — analyst grade events. */
export const NEWS_GRADES_TTL_S = 12 * SECONDS_PER_HOUR;
