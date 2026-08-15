import {
    MARKET_FEAR_GREED_SERIES_KEYS,
    type MarketFearGreedSeriesKey,
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
 * warm up the momentum window plus 60 more for `confidence: 'normal'`; three
 * calendar years yields roughly 750 sessions, which also covers the "1 year
 * ago" comparison the page renders.
 */
export const MARKET_FEAR_GREED_LOOKBACK_DAYS = 1095;

/** Every series key paired with its FMP ticker, in a stable order. */
export const MARKET_FEAR_GREED_SERIES = MARKET_FEAR_GREED_SERIES_KEYS.map(
    key => ({ key, symbol: MARKET_FEAR_GREED_SYMBOLS[key] })
);
