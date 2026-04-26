import type { Bar } from '@/domain/types';
import { MFI_DEFAULT_PERIOD } from '@y0ngha/siglens-core';
import { typicalPrice } from '@/domain/indicators/utils';

const MFI_MAX = 100;

export function calculateMFI(
    bars: Bar[],
    period = MFI_DEFAULT_PERIOD
): (number | null)[] {
    if (bars.length === 0) return [];
    if (bars.length <= period) return bars.map(() => null);

    const tps = bars.map(b => typicalPrice(b.high, b.low, b.close));
    const rawMFs = tps.map((tp, i) => tp * bars[i].volume);

    return bars.map((_, i) => {
        if (i < period) return null;

        const windowTPs = tps.slice(i - period, i + 1);
        const windowMFs = rawMFs.slice(i - period, i + 1);

        const slicedTPs = windowTPs.slice(1);
        const positive = slicedTPs
            .map((tp, j) => (tp > windowTPs[j] ? windowMFs[j + 1] : 0))
            .reduce((sum, v) => sum + v, 0);
        const negative = slicedTPs
            .map((tp, j) => (tp < windowTPs[j] ? windowMFs[j + 1] : 0))
            .reduce((sum, v) => sum + v, 0);

        if (negative === 0) return MFI_MAX;
        const mfRatio = positive / negative;
        return MFI_MAX - MFI_MAX / (1 + mfRatio);
    });
}
