import { MS_PER_DAY } from '@/domain/constants/time';

/** Lookback window for the news list UI display and per-card enrichment; matches the `NewsTimeRange` `'7d'` window. */
export const NEWS_LOOKBACK_MS = 7 * MS_PER_DAY;

/**
 * Wider lookback window used by the AI aggregate news analysis.
 * Matches the `NewsTimeRange` `'30d'` window — broader context improves
 * the LLM's ability to identify multi-week narrative shifts.
 */
export const NEWS_ANALYSIS_LOOKBACK_MS = 30 * MS_PER_DAY;
