import type { Bar, IndicatorResult } from '@/domain/types';
import { calculateRSI } from './rsi';
import { calculateMACD } from './macd';
import { calculateBollinger } from './bollinger';
import { calculateDMI } from './dmi';
import { calculateVWAP } from './vwap';
import { calculateEMA } from './ema';
import { calculateMA } from './ma';
import { calculateStochastic } from './stochastic';
import { calculateStochRSI } from './stochastic-rsi';
import { MA_DEFAULT_PERIODS, EMA_DEFAULT_PERIODS } from './constants';

export * from './rsi';
export * from './macd';
export * from './bollinger';
export * from './dmi';
export * from './vwap';
export * from './ema';
export * from './ma';
export * from './stochastic';
export * from './stochastic-rsi';

export function calculateIndicators(bars: Bar[]): IndicatorResult {
    const closes = bars.map(b => b.close);
    return {
        rsi: calculateRSI(closes),
        macd: calculateMACD(bars),
        bollinger: calculateBollinger(bars),
        dmi: calculateDMI(bars),
        stochastic: calculateStochastic(bars),
        stochRsi: calculateStochRSI(closes),
        vwap: calculateVWAP(bars),
        ma: Object.fromEntries(
            MA_DEFAULT_PERIODS.map(period => [
                period,
                calculateMA(bars, period),
            ])
        ) as Record<number, (number | null)[]>,
        ema: Object.fromEntries(
            EMA_DEFAULT_PERIODS.map(period => [
                period,
                calculateEMA(bars, period),
            ])
        ) as Record<number, (number | null)[]>,
    };
}
