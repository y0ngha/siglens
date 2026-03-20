import type { Bar, MACDResult } from '@/domain/types';
import { calculateEMA } from '@/domain/indicators/ema';
import {
    MACD_FAST_PERIOD,
    MACD_SIGNAL_PERIOD,
    MACD_SLOW_PERIOD,
} from '@/domain/indicators/constants';

function computeSignalEMA(values: number[], period: number): (number | null)[] {
    if (values.length <= period) return values.map(() => null);

    const multiplier = 2 / (period + 1);
    const initialSMA =
        values.slice(0, period).reduce((sum, v) => sum + v, 0) / period;

    const result: (number | null)[] = new Array(period).fill(null);

    values.slice(period).reduce((prev, v) => {
        const ema = v * multiplier + prev * (1 - multiplier);
        result.push(ema);
        return ema;
    }, initialSMA);

    return result;
}

export function calculateMACD(
    bars: Bar[],
    fastPeriod = MACD_FAST_PERIOD,
    slowPeriod = MACD_SLOW_PERIOD,
    signalPeriod = MACD_SIGNAL_PERIOD
): MACDResult[] {
    if (bars.length === 0) return [];

    const fastEMA = calculateEMA(bars, fastPeriod);
    const slowEMA = calculateEMA(bars, slowPeriod);

    const macdLine: (number | null)[] = fastEMA.map(
        (fast: number | null, i: number) => {
            const slow = slowEMA[i];
            return fast !== null && slow !== null ? fast - slow : null;
        }
    );

    const macdNonNull = macdLine.filter((v): v is number => v !== null);
    const signalValues = computeSignalEMA(macdNonNull, signalPeriod);

    const slowStart = slowPeriod - 1;

    return bars.map((_, i) => {
        const macd = macdLine[i];
        if (macd === null) return { macd: null, signal: null, histogram: null };

        const signalIdx = i - slowStart;
        const signal =
            signalIdx >= 0 && signalIdx < signalValues.length
                ? signalValues[signalIdx]
                : null;

        if (signal === null) return { macd, signal: null, histogram: null };

        return { macd, signal, histogram: macd - signal };
    });
}
