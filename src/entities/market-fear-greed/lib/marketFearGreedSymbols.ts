import {
    MARKET_FEAR_GREED_SERIES_KEYS,
    type MarketFearGreedSeriesKey,
    FEAR_GREED_LOOKBACK_DAYS,
} from '@y0ngha/siglens-core';

/**
 * Semantic series key → FMP ticker. `siglens-core` deliberately speaks in
 * economic roles rather than tickers, so this table is the one place that knows
 * the index is backed by FMP at all (SCOPE.md §3 Step 3 — data-source knowledge
 * belongs to the consumer).
 *
 * `sp500` is SPY rather than the `^GSPC` index because three of the five
 * factors are return *differences* against ETFs (TLT / HYG / LQD / RSP). Mixing
 * an index level with ETF prices would compare a dividend-excluded series
 * against dividend-excluded ones on a different basis; using SPY keeps every
 * leg on the same footing.
 */
export const MARKET_FEAR_GREED_SYMBOLS = {
    sp500: 'SPY',
    vix: '^VIX',
    longTreasury: 'TLT',
    highYield: 'HYG',
    investmentGrade: 'LQD',
    equalWeight: 'RSP',
} as const satisfies Record<MarketFearGreedSeriesKey, string>;

/**
 * Calendar-day lookback requested from FMP. The index needs 125 sessions to
 * warm up the momentum window plus 60 more for `confidence: 'normal'`, and the
 * page renders a "1 year ago" comparison.
 *
 * Five years since core 2.10.0 (`FEAR_GREED_LOOKBACK_DAYS`): every reading is a
 * percentile against this history, so per-instrument and market-wide indices
 * share one window — two years left too few extreme-zone episodes to say
 * anything, and a longer past steadies the baseline. Changing this changes every
 * score, so it follows the core constant rather than a local number.
 */
export const MARKET_FEAR_GREED_LOOKBACK_DAYS = FEAR_GREED_LOOKBACK_DAYS;

/** Every series key paired with its FMP ticker, in a stable order. */
export const MARKET_FEAR_GREED_SERIES = MARKET_FEAR_GREED_SERIES_KEYS.map(
    key => ({ key, symbol: MARKET_FEAR_GREED_SYMBOLS[key] })
);
