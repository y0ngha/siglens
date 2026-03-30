import type { IndicatorResult } from '@/domain/types';

export const EMPTY_INDICATOR_RESULT: IndicatorResult = {
    macd: [],
    bollinger: [],
    dmi: [],
    rsi: [],
    vwap: [],
    ma: {},
    ema: {},
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

export const MA_DEFAULT_PERIODS = [20] as const;
export const EMA_DEFAULT_PERIODS = [9, 20, 21, 60] as const;

export const EMA_SUPPORT_RESISTANCE_SHORT_INDEX = 1; // 20-period EMA
export const EMA_SUPPORT_RESISTANCE_LONG_INDEX = 3; // 60-period EMA

export const HIGH_CONFIDENCE_WEIGHT = 0.8;
export const MIN_CONFIDENCE_WEIGHT = 0.5;
export const UNMATCHED_SKILL_CONFIDENCE_WEIGHT = 0;
