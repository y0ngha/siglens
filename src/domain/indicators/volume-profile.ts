import type {
    Bar,
    VolumeProfileResult,
    VolumeProfileRow,
} from '@/domain/types';
import {
    VP_DEFAULT_ROW_SIZE,
    VP_MIN_BARS,
    VP_VALUE_AREA_PERCENTAGE,
} from './constants';

interface ValueAreaState {
    vahIndex: number;
    valIndex: number;
    accumulatedVolume: number;
}

export function calculateVolumeProfile(
    bars: Bar[],
    rowSize: number = VP_DEFAULT_ROW_SIZE
): VolumeProfileResult | null {
    if (bars.length < VP_MIN_BARS) return null;

    const highMax = bars.reduce(
        (max, bar) => Math.max(max, bar.high),
        -Infinity
    );
    const lowMin = bars.reduce((min, bar) => Math.min(min, bar.low), Infinity);
    const priceRange = highMax - lowMin;

    if (priceRange === 0) return null;

    const bucketSize = priceRange / rowSize;

    const bucketVolumes = bars.reduce(
        (acc, bar) => {
            const barRange = bar.high - bar.low;
            if (barRange === 0) {
                return acc.map((vol, i) => {
                    const bucketLow = lowMin + i * bucketSize;
                    const bucketHigh = bucketLow + bucketSize;
                    const isLastBucket = i === rowSize - 1;
                    const inBucket =
                        (bar.low >= bucketLow && bar.low < bucketHigh) ||
                        (isLastBucket && bar.low === bucketHigh);
                    return inBucket ? vol + bar.volume : vol;
                });
            }
            return acc.map((vol, i) => {
                const bucketLow = lowMin + i * bucketSize;
                const bucketHigh = bucketLow + bucketSize;
                const overlap =
                    Math.min(bar.high, bucketHigh) -
                    Math.max(bar.low, bucketLow);
                if (overlap > 0) {
                    return vol + bar.volume * (overlap / barRange);
                }
                return vol;
            });
        },
        Array.from<number>({ length: rowSize }).fill(0)
    );

    const pocIndex = bucketVolumes.reduce(
        (maxIdx, vol, idx) => (vol > bucketVolumes[maxIdx] ? idx : maxIdx),
        0
    );

    const totalVolume = bucketVolumes.reduce((sum, vol) => sum + vol, 0);
    const targetVolume = totalVolume * VP_VALUE_AREA_PERCENTAGE;

    const expandValueArea = (state: ValueAreaState): ValueAreaState => {
        if (state.accumulatedVolume >= targetVolume) return state;

        const nextAbove =
            state.vahIndex + 1 < rowSize
                ? bucketVolumes[state.vahIndex + 1]
                : -1;
        const nextBelow =
            state.valIndex - 1 >= 0 ? bucketVolumes[state.valIndex - 1] : -1;

        if (nextAbove <= 0 && nextBelow <= 0) return state;

        if (nextAbove >= nextBelow) {
            const newVahIndex = state.vahIndex + 1;
            return expandValueArea({
                vahIndex: newVahIndex,
                valIndex: state.valIndex,
                accumulatedVolume:
                    state.accumulatedVolume + bucketVolumes[newVahIndex],
            });
        }

        const newValIndex = state.valIndex - 1;
        return expandValueArea({
            vahIndex: state.vahIndex,
            valIndex: newValIndex,
            accumulatedVolume:
                state.accumulatedVolume + bucketVolumes[newValIndex],
        });
    };

    const { vahIndex, valIndex } = expandValueArea({
        vahIndex: pocIndex,
        valIndex: pocIndex,
        accumulatedVolume: bucketVolumes[pocIndex],
    });

    const bucketCenter = (i: number): number =>
        lowMin + i * bucketSize + bucketSize / 2;

    const profile: VolumeProfileRow[] = bucketVolumes.map((volume, i) => ({
        price: bucketCenter(i),
        volume,
    }));

    return {
        poc: bucketCenter(pocIndex),
        vah: bucketCenter(vahIndex),
        val: bucketCenter(valIndex),
        profile,
    };
}
