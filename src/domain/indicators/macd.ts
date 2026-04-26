import type { Bar, MACDResult } from '@/domain/types';
import { calculateEMA, computeEMAValues } from '@/domain/indicators/ema';
import {
    MACD_FAST_PERIOD,
    MACD_SIGNAL_PERIOD,
    MACD_SLOW_PERIOD,
} from '@y0ngha/siglens-core';

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
    const signalValues = computeEMAValues(macdNonNull, signalPeriod);

    const firstMacdIdx = Math.max(fastPeriod, slowPeriod) - 1;

    return bars.map((_, i) => {
        const macd = macdLine[i];
        if (macd === null) return { macd: null, signal: null, histogram: null };

        const signalIdx = i - firstMacdIdx;
        const signal =
            signalIdx >= 0 && signalIdx < signalValues.length
                ? signalValues[signalIdx]
                : null;

        if (signal === null) return { macd, signal: null, histogram: null };

        return { macd, signal, histogram: macd - signal };
    });
}
