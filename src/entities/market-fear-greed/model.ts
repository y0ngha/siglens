import type {
    FearGreedLabel,
    MarketFearGreedSnapshot,
} from '@y0ngha/siglens-core';

/** The four lookbacks the page compares the current reading against. */
export type MarketFearGreedComparisonKey = 'now' | '1w' | '1m' | '1y';

/** One historical reading, already resolved to a concrete session. */
export interface MarketFearGreedComparisonPoint {
    /** Which lookback this point answers. */
    key: MarketFearGreedComparisonKey;
    /** ISO `YYYY-MM-DD` of the session actually used (may be clamped to the earliest available). */
    date: string;
    /** Score in [0, 100]. */
    score: number;
    /** Five-stage label for `score`. */
    label: FearGreedLabel;
}

/**
 * Everything the market Fear & Greed page renders.
 *
 * The walk-forward history is *not* carried here: it runs to ~750 sessions and
 * the page only reads four of them, so it is reduced to `comparisons` at the
 * cache boundary rather than serialised into the RSC payload.
 */
export interface MarketFearGreedView {
    /** Latest reading, or `null` when the data is insufficient. */
    snapshot: MarketFearGreedSnapshot | null;
    /** Current + 1 week / 1 month / 1 year ago, in that order. Empty when `snapshot` is `null`. */
    comparisons: MarketFearGreedComparisonPoint[];
}
