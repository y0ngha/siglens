import type { Bar, BollingerResult } from '@/domain/types';
import {
    BOLLINGER_DEFAULT_PERIOD,
    BOLLINGER_DEFAULT_STD_DEV,
} from '@/domain/indicators/constants';

export function calculateBollinger(
    bars: Bar[],
    period = BOLLINGER_DEFAULT_PERIOD,
    stdDev = BOLLINGER_DEFAULT_STD_DEV
): BollingerResult[] {
    if (bars.length < period)
        return bars.map(() => ({ upper: null, middle: null, lower: null }));

    const closes = bars.map(bar => bar.close);

    return closes.map((_, i) => {
        if (i < period - 1) return { upper: null, middle: null, lower: null };

        const priceWindow = closes.slice(i - period + 1, i + 1);
        const middle = priceWindow.reduce((sum, v) => sum + v, 0) / period;
        const variance =
            priceWindow.reduce((sum, v) => sum + (v - middle) ** 2, 0) / period;
        const std = Math.sqrt(variance);

        return {
            upper: middle + stdDev * std,
            middle,
            lower: middle - stdDev * std,
        };
    });
}
