import { MS_PER_DAY } from '@/domain/constants/time';

/** Lookback window for the news list UI display and per-card enrichment (6 months). */
export const NEWS_LOOKBACK_MS = 180 * MS_PER_DAY;

/**
 * Lookback window used by the AI aggregate news analysis (~1 month).
 * Narrower than `NEWS_LOOKBACK_MS` so the LLM focuses on recent drivers
 * rather than diluting the signal with older context.
 */
export const NEWS_ANALYSIS_LOOKBACK_MS = 30 * MS_PER_DAY;
