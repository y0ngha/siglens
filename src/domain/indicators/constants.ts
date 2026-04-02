import type { IndicatorResult } from '@/domain/types';

export const EMPTY_INDICATOR_RESULT: IndicatorResult = {
    macd: [],
    bollinger: [],
    dmi: [],
    stochastic: [],
    stochRsi: [],
    rsi: [],
    cci: [],
    vwap: [],
    ma: {},
    ema: {},
    volumeProfile: null,
};

export const RSI_DEFAULT_PERIOD = 14;
export const RSI_OVERBOUGHT_LEVEL = 70;
export const RSI_OVERSOLD_LEVEL = 30;

export const MACD_FAST_PERIOD = 12;
export const MACD_SLOW_PERIOD = 26;
export const MACD_SIGNAL_PERIOD = 9;

export const BOLLINGER_DEFAULT_PERIOD = 20;
export const BOLLINGER_DEFAULT_STD_DEV = 2;

export const DMI_DEFAULT_PERIOD = 14;

export const STOCHASTIC_K_PERIOD = 14;
export const STOCHASTIC_D_PERIOD = 3;
export const STOCHASTIC_SMOOTHING = 3;
export const STOCHASTIC_OVERBOUGHT_LEVEL = 80;
export const STOCHASTIC_OVERSOLD_LEVEL = 20;

export const STOCH_RSI_RSI_PERIOD = 14;
export const STOCH_RSI_STOCH_PERIOD = 14;
export const STOCH_RSI_K_PERIOD = 3;
export const STOCH_RSI_D_PERIOD = 3;
export const STOCH_RSI_OVERBOUGHT_LEVEL = 0.8;
export const STOCH_RSI_OVERSOLD_LEVEL = 0.2;

export const CCI_DEFAULT_PERIOD = 20;
export const CCI_NORMALIZATION_CONSTANT = 0.015;
export const CCI_OVERBOUGHT_LEVEL = 100;
export const CCI_OVERSOLD_LEVEL = -100;
export const CCI_ZERO_LEVEL = 0;

export const MA_DEFAULT_PERIODS = [20] as const;
export const EMA_DEFAULT_PERIODS = [9, 20, 21, 60] as const;

export const EMA_SUPPORT_RESISTANCE_SHORT_INDEX = 1; // 20-period EMA
export const EMA_SUPPORT_RESISTANCE_LONG_INDEX = 3; // 60-period EMA

export const VP_DEFAULT_ROW_SIZE = 24;
export const VP_VALUE_AREA_PERCENTAGE = 0.7;
export const VP_MIN_BARS = 30;

export const HIGH_CONFIDENCE_WEIGHT = 0.8;
export const MEDIUM_CONFIDENCE_WEIGHT = 0.7;
export const MIN_CONFIDENCE_WEIGHT = 0.5;
export const UNMATCHED_SKILL_CONFIDENCE_WEIGHT = 0;
