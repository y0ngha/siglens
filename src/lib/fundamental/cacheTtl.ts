/**
 * TTL constants for fundamental section data caching, aligned with plan §3.2.
 *
 * TTL tiers:
 * - T2: Real-time / 1h–24h  — analyst data, sector snapshots
 * - T3: Weekly 7d           — ratios, growth, health (earnings-calendar aware; 7d static fallback)
 * - T4: Monthly 30d         — profile, peers (very slow-changing)
 */
import { SECONDS_PER_DAY, SECONDS_PER_HOUR } from '@/domain/constants/time';

/** T4: 30 days — company profile, peer list (very slow-changing). */
export const TTL_T4_30D = 30 * SECONDS_PER_DAY;

/** T3: 7 days — ratios, growth, financial health (static fallback until earnings-calendar TTL is wired). */
export const TTL_T3_7D = 7 * SECONDS_PER_DAY;

/** T2: 24 hours — analyst estimates, grades consensus, price targets. */
export const TTL_T2_24H = SECONDS_PER_DAY;

/** T2: 1 hour — sector performance snapshot (today's live data). */
export const TTL_T2_1H = SECONDS_PER_HOUR;
