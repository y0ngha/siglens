import type { Bar } from '@/domain/types';
import { WILLIAMS_R_DEFAULT_PERIOD } from '@y0ngha/siglens-core';

const WILLIAMS_R_MIDPOINT = -50;
const WILLIAMS_R_SCALE = -100;

export function calculateWilliamsR(
    bars: Bar[],
    period = WILLIAMS_R_DEFAULT_PERIOD
): (number | null)[] {
    if (bars.length === 0) return [];
    if (bars.length < period) return bars.map(() => null);

    return bars.map((bar, i) => {
        if (i < period - 1) return null;
        const window = bars.slice(i - period + 1, i + 1);
        const highestHigh = Math.max(...window.map(b => b.high));
        const lowestLow = Math.min(...window.map(b => b.low));
        const range = highestHigh - lowestLow;
        if (range === 0) return WILLIAMS_R_MIDPOINT;
        return ((highestHigh - bar.close) / range) * WILLIAMS_R_SCALE;
    });
}
