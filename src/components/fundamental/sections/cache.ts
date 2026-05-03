/**
 * Shared cache TTL constants for fundamental section components.
 *
 * TTL tiers (from plan §3.2):
 * - T2: Real-time / 1h–24h  — analyst data, sector snapshots
 * - T3: Weekly 7d           — ratios, growth, health (earnings-calendar aware; 7d static fallback)
 * - T4: Monthly 30d         — profile, peers (very slow-changing)
 */

/** T4: 30 days — company profile, peer list (very slow-changing). */
export const TTL_T4_30D = 30 * 24 * 60 * 60;

/** T3: 7 days — ratios, growth, financial health (static fallback until earnings-calendar TTL is wired). */
export const TTL_T3_7D = 7 * 24 * 60 * 60;

/** T2: 24 hours — analyst estimates, grades consensus, price targets. */
export const TTL_T2_24H = 24 * 60 * 60;

/** T2: 1 hour — sector performance snapshot (today's live data). */
export const TTL_T2_1H = 60 * 60;
