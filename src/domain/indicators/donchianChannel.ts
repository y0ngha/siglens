import type { Bar, DonchianChannelResult } from '@/domain/types';
import { DONCHIAN_DEFAULT_PERIOD } from '@y0ngha/siglens-core';

export function calculateDonchianChannel(
    bars: Bar[],
    period = DONCHIAN_DEFAULT_PERIOD
): DonchianChannelResult[] {
    if (bars.length === 0) return [];
    if (bars.length < period)
        return bars.map(() => ({ upper: null, middle: null, lower: null }));

    return bars.map((_, i) => {
        if (i < period - 1) return { upper: null, middle: null, lower: null };

        const window = bars.slice(i - period + 1, i + 1);
        const upper = Math.max(...window.map(b => b.high));
        const lower = Math.min(...window.map(b => b.low));
        const middle = (upper + lower) / 2;

        return { upper, middle, lower };
    });
}
