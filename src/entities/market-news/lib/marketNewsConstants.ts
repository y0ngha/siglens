import { MS_PER_DAY } from '@/shared/config/time';

/**
 * Display lookback window for category feeds.
 * Market news churns fast — 7 days captures relevant context without
 * accumulating stale articles that bloat the digest prompt.
 */
export const MARKET_NEWS_LOOKBACK_MS = 7 * MS_PER_DAY;

/** Max cards rendered on a category page. */
export const MAX_MARKET_NEWS_CARDS = 40;

/** Items fetched per category feed from FMP (we render up to MAX_MARKET_NEWS_CARDS=40 of them). */
export const FMP_NEWS_FETCH_LIMIT = 50;
