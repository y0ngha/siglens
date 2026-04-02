import type { Bar } from '@/domain/types';
import { CCI_DEFAULT_PERIOD, CCI_NORMALIZATION_CONSTANT } from './constants';
import { sma, typicalPrice } from './utils';

export function calculateCCI(
    bars: Bar[],
    period = CCI_DEFAULT_PERIOD
): (number | null)[] {
    if (bars.length === 0) return [];
    if (bars.length < period) return bars.map(() => null);

    const typicalPrices = bars.map(bar =>
        typicalPrice(bar.high, bar.low, bar.close)
    );

    const nullPrefix: (number | null)[] = new Array(period - 1).fill(null);

    const computedValues: (number | null)[] = Array.from(
        { length: typicalPrices.length - period + 1 },
        (_, i) => {
            const tpSlice = typicalPrices.slice(i, i + period);
            const smaValue = sma(tpSlice, period)!;
            const meanDeviation =
                tpSlice.reduce((sum, tp) => sum + Math.abs(tp - smaValue), 0) /
                period;
            const currentTP = typicalPrices[i + period - 1];
            return meanDeviation === 0
                ? 0
                : (currentTP - smaValue) /
                      (CCI_NORMALIZATION_CONSTANT * meanDeviation);
        }
    );

    return [...nullPrefix, ...computedValues];
}
