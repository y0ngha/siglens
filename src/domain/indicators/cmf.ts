import type { Bar } from '@/domain/types';
import { CMF_DEFAULT_PERIOD } from '@/domain/indicators/constants';

function clv(bar: Bar): number {
    const range = bar.high - bar.low;
    if (range === 0) return 0;
    return (bar.close - bar.low - (bar.high - bar.close)) / range;
}

export function calculateCMF(
    bars: Bar[],
    period = CMF_DEFAULT_PERIOD
): (number | null)[] {
    if (bars.length === 0) return [];
    if (bars.length < period) return bars.map(() => null);

    const mfVolumes = bars.map(bar => clv(bar) * bar.volume);
    const volumes = bars.map(bar => bar.volume);

    return bars.map((_, i) => {
        if (i < period - 1) return null;
        const mfvSum = mfVolumes
            .slice(i - period + 1, i + 1)
            .reduce((sum, v) => sum + v, 0);
        const volSum = volumes
            .slice(i - period + 1, i + 1)
            .reduce((sum, v) => sum + v, 0);
        if (volSum === 0) return 0;
        return mfvSum / volSum;
    });
}
