import { SECONDS_PER_DAY } from '@/domain/constants/time';
import type { Bar } from '@/domain/types';
import { typicalPrice } from './utils';

interface VWAPState {
    cumulativeTPV: number;
    cumulativeVolume: number;
    dayKey: number;
    results: (number | null)[];
}

export function calculateVWAP(bars: Bar[]): (number | null)[] {
    if (bars.length === 0) return [];

    return bars.reduce<VWAPState>(
        (acc, bar) => {
            const dayKey = Math.floor(bar.time / SECONDS_PER_DAY);
            const reset = dayKey !== acc.dayKey;
            const cumulativeTPV = reset ? 0 : acc.cumulativeTPV;
            const cumulativeVolume = reset ? 0 : acc.cumulativeVolume;
            const tp = typicalPrice(bar.high, bar.low, bar.close);
            const newTPV = cumulativeTPV + tp * bar.volume;
            const newVolume = cumulativeVolume + bar.volume;
            const vwap = newVolume === 0 ? null : newTPV / newVolume;
            return {
                cumulativeTPV: newTPV,
                cumulativeVolume: newVolume,
                dayKey,
                results: [...acc.results, vwap],
            };
        },
        { cumulativeTPV: 0, cumulativeVolume: 0, dayKey: -1, results: [] }
    ).results;
}
