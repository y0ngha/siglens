import { MS_PER_DAY } from '@/shared/config/time';

/**
 * Display lookback window for category feeds.
 * Market news churns fast — 7 days captures relevant context without
 * accumulating stale articles that bloat the digest prompt.
 */
export const MARKET_NEWS_LOOKBACK_MS = 7 * MS_PER_DAY;

/** Max cards rendered on a category page. */
export const MAX_MARKET_NEWS_CARDS = 40;
