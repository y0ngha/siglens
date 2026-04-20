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
export const TREND_EMA_PERIOD = 20;

// Moving averages used by detectors that are NOT in MA_DEFAULT_PERIODS
export const GOLDEN_CROSS_FAST_PERIOD = 20;
export const GOLDEN_CROSS_SLOW_PERIOD = 50;
export const SR_MA_PERIODS = [50, 200] as const;

// ─── Bullish detector thresholds (buy-only backtest) ─────────────────────────

export const DMI_ADX_TREND_THRESHOLD = 20; // DMI 골든크로스 성립을 위한 최소 ADX
export const CCI_OVERSOLD_CROSS_LEVEL = -100; // CCI -100 상향 돌파
export const CCI_BULLISH_CROSS_LEVEL = 100; // CCI +100 상향 돌파
export const CMF_BULLISH_CROSS_LEVEL = 0; // CMF 0 상향 (매집 전환)
export const MFI_OVERSOLD_LEVEL = 20; // MFI 20 상향 돌파 (과매도 반등)
export const SQUEEZE_MOMENTUM_ZERO_CROSS = 0; // 히스토그램 0 상향 돌파
