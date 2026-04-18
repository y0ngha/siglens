// Confirmed signal thresholds
export const CROSS_LOOKBACK_BARS = 3;

// Anticipation signal thresholds
export const DIVERGENCE_LOOKBACK_BARS = 20;
export const DIVERGENCE_FRESHNESS_BARS = 5;
export const PIVOT_WINDOW = 2;

export const HISTOGRAM_CONVERGENCE_BARS = 5;

export const SQUEEZE_LOOKBACK_BARS = 120;
export const SQUEEZE_PERCENTILE = 0.1;
export const SQUEEZE_PCT_B_THRESHOLD = 0.5;

export const SR_PROXIMITY_PCT = 0.02;
export const SR_APPROACH_LOOKBACK = 5;

// Trend classification
export const TREND_SLOPE_LOOKBACK = 20;
export const TREND_SLOPE_THRESHOLD = 0.03;

// Moving averages used by detectors that are NOT in MA_DEFAULT_PERIODS
export const GOLDEN_CROSS_FAST_PERIOD = 20;
export const GOLDEN_CROSS_SLOW_PERIOD = 50;
export const SR_MA_PERIODS = [50, 200] as const;
