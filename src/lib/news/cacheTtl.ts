/**
 * TTL constants for news section data caching.
 *
 * TTL tiers (news-specific):
 * - T1: 15 minutes   — news list (articles change frequently throughout the day)
 * - T2: 12 hours     — analyst grades events (change a few times per day)
 * - T3: 7 days       — earnings reports (very slow-changing)
 */
import { SECONDS_PER_DAY, SECONDS_PER_HOUR } from '@/domain/constants/time';

/** T1: 15 minutes — news list snapshot. */
export const NEWS_LIST_TTL_S = 15 * 60;

/** T2: 12 hours — analyst grade events. */
export const NEWS_GRADES_TTL_S = 12 * SECONDS_PER_HOUR;

/** T3: 7 days — earnings calendar + reports (static fallback). */
export const NEWS_EARNINGS_REPORT_TTL_S = 7 * SECONDS_PER_DAY;
