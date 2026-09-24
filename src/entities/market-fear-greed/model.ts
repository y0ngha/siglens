import type {
    CryptoFearGreedSnapshot,
    FearGreedLabel,
    MarketFearGreedSnapshot,
} from '@y0ngha/siglens-core';

/**
 * What the widgets read from a snapshot. Both core snapshot types satisfy it;
 * `factors[].key` stays a plain string so labels are looked up per market.
 */
export interface MarketFearGreedViewSnapshot {
    score: number;
    label: FearGreedLabel;
    factors: ReadonlyArray<{
        key: string;
        rawValue: number;
        percentile: number;
    }>;
    confidence: 'normal' | 'limited';
    sampleSize: number;
    asOf: string;
}

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
 *
 * Generic over the snapshot so the market (`MarketFearGreedSnapshot`) and crypto
 * (`CryptoFearGreedSnapshot`) readings render through the same widgets without
 * casts — the two share everything but the factor key set.
 */
export interface MarketFearGreedView<
    S extends MarketFearGreedViewSnapshot = MarketFearGreedSnapshot,
> {
    /** Latest reading, or `null` when the data is insufficient. */
    snapshot: S | null;
    /** Current + 1 week / 1 month / 1 year ago, in that order. Empty when `snapshot` is `null`. */
    comparisons: MarketFearGreedComparisonPoint[];
}

/** Crypto reading: same view, crypto snapshot (six crypto factor keys). */
export type MarketFearGreedCryptoView =
    MarketFearGreedView<CryptoFearGreedSnapshot>;
