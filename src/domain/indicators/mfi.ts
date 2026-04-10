import type { Bar } from '@/domain/types';
import { MFI_DEFAULT_PERIOD } from '@/domain/indicators/constants';
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

        const { positive, negative } = windowTPs.slice(1).reduce(
            (acc, tp, j) => {
                const prevTP = windowTPs[j];
                const mf = windowMFs[j + 1];
                return tp > prevTP
                    ? { positive: acc.positive + mf, negative: acc.negative }
                    : tp < prevTP
                      ? {
                            positive: acc.positive,
                            negative: acc.negative + mf,
                        }
                      : acc;
            },
            { positive: 0, negative: 0 }
        );

        if (negative === 0) return MFI_MAX;
        const mfRatio = positive / negative;
        return MFI_MAX - MFI_MAX / (1 + mfRatio);
    });
}
