import type { Bar } from '@/domain/types';
import { ATR_DEFAULT_PERIOD } from '@/domain/indicators/constants';

function trueRange(bar: Bar, prev: Bar): number {
    return Math.max(
        bar.high - bar.low,
        Math.abs(bar.high - prev.close),
        Math.abs(bar.low - prev.close)
    );
}

export function calculateATR(
    bars: Bar[],
    period = ATR_DEFAULT_PERIOD
): (number | null)[] {
    if (bars.length === 0) return [];
    if (bars.length <= period) return bars.map(() => null);

    const trValues = bars.slice(1).map((bar, i) => trueRange(bar, bars[i]));

    const initialATR =
        trValues.slice(0, period).reduce((sum, tr) => sum + tr, 0) / period;

    const atrValues = trValues.slice(period).reduce<number[]>(
        (acc, tr) => {
            const prev = acc[acc.length - 1];
            return [...acc, (prev * (period - 1) + tr) / period];
        },
        [initialATR]
    );

    return [...new Array(period).fill(null), ...atrValues];
}
