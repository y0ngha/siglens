import { MS_PER_DAY } from '@/shared/config/time';
import type { ModelId } from '@y0ngha/siglens-core';

/** Display lookback window in days for category feeds (market news churns fast — single source for both ms and UI copy). */
export const MARKET_NEWS_LOOKBACK_DAYS = 7;

/**
 * Display lookback window for category feeds, derived from
 * {@link MARKET_NEWS_LOOKBACK_DAYS}.
 * Market news churns fast — {@link MARKET_NEWS_LOOKBACK_DAYS} days captures
 * relevant context without accumulating stale articles that bloat the digest
 * prompt.
 */
export const MARKET_NEWS_LOOKBACK_MS = MARKET_NEWS_LOOKBACK_DAYS * MS_PER_DAY;

/** Max cards rendered on a category page. */
export const MAX_MARKET_NEWS_CARDS = 40;

/** Items fetched per category feed from FMP (we render up to {@link MAX_MARKET_NEWS_CARDS} of them). */
export const FMP_NEWS_FETCH_LIMIT = 50;

/**
 * Fixed server-side model for the public category digest.
 * No BYOK — the digest is gating-free and uses a single shared model.
 * `'gemini-2.5-flash'` is a valid {@link ModelId} member (verified against
 * the installed `@y0ngha/siglens-core` `TierModel` union).
 */
export const DEFAULT_DIGEST_MODEL_ID = 'gemini-2.5-flash' satisfies ModelId;

/** ISR cache-tag prefix for market-news sentinel buckets. Combined with the sentinel as `${prefix}:${sentinel}`. */
export const MARKET_NEWS_CACHE_TAG_PREFIX = 'market-news';
