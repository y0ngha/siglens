import { SECONDS_PER_DAY, SECONDS_PER_HOUR } from '@/domain/constants/time';

/** T4: 30 days — company profile, peer list (very slow-changing). */
export const TTL_T4_30D = 30 * SECONDS_PER_DAY;

/** T3: 7 days — ratios, growth, financial health (static fallback until earnings-calendar TTL is wired). */
export const TTL_T3_7D = 7 * SECONDS_PER_DAY;

/** T2: 24 hours — analyst estimates, grades consensus, price targets. */
export const TTL_T2_24H = SECONDS_PER_DAY;

/** T2: 1 hour — sector performance snapshot (today's live data). */
export const TTL_T2_1H = SECONDS_PER_HOUR;
