import type { Bar } from '@/domain/types';
import { CCI_DEFAULT_PERIOD, CCI_NORMALIZATION_CONSTANT } from './constants';

export function calculateCCI(
    bars: Bar[],
    period = CCI_DEFAULT_PERIOD
): (number | null)[] {
    if (bars.length === 0) return [];
    if (bars.length < period) return bars.map(() => null);

    const typicalPrices = bars.map(bar => (bar.high + bar.low + bar.close) / 3);

    const nulls: (number | null)[] = new Array(period - 1).fill(null);

    const cciValues: (number | null)[] = typicalPrices
        .slice(period - 1)
        .map((_, i) => {
            const tpSlice = typicalPrices.slice(i, i + period);
            const sma = tpSlice.reduce((sum, tp) => sum + tp, 0) / period;
            const meanDeviation =
                tpSlice.reduce((sum, tp) => sum + Math.abs(tp - sma), 0) /
                period;

            return meanDeviation === 0
                ? 0
                : (tpSlice[tpSlice.length - 1] - sma) /
                      (CCI_NORMALIZATION_CONSTANT * meanDeviation);
        });

    return [...nulls, ...cciValues];
}
