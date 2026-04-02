import type { Bar, IchimokuResult } from '@/domain/types';
import {
    ICHIMOKU_CONVERSION_PERIOD,
    ICHIMOKU_BASE_PERIOD,
    ICHIMOKU_SPAN_B_PERIOD,
    ICHIMOKU_DISPLACEMENT,
} from '@/domain/indicators/constants';

function periodMidpoint(
    bars: Bar[],
    endIndex: number,
    period: number
): number | null {
    if (endIndex < period - 1) return null;
    const slice = bars.slice(endIndex - period + 1, endIndex + 1);
    const highest = slice.reduce(
        (max, bar) => (bar.high > max ? bar.high : max),
        slice[0].high
    );
    const lowest = slice.reduce(
        (min, bar) => (bar.low < min ? bar.low : min),
        slice[0].low
    );
    return (highest + lowest) / 2;
}

function calculateSenkouA(
    bars: Bar[],
    sourceIndex: number,
    conversionPeriod: number,
    basePeriod: number
): number | null {
    const t = periodMidpoint(bars, sourceIndex, conversionPeriod);
    const k = periodMidpoint(bars, sourceIndex, basePeriod);
    return t !== null && k !== null ? (t + k) / 2 : null;
}

export function calculateIchimoku(
    bars: Bar[],
    conversionPeriod = ICHIMOKU_CONVERSION_PERIOD,
    basePeriod = ICHIMOKU_BASE_PERIOD,
    spanBPeriod = ICHIMOKU_SPAN_B_PERIOD,
    displacement = ICHIMOKU_DISPLACEMENT
): IchimokuResult[] {
    if (bars.length === 0) return [];
    if (bars.length < conversionPeriod)
        return bars.map(() => ({
            tenkan: null,
            kijun: null,
            senkouA: null,
            senkouB: null,
            chikou: null,
        }));

    return bars.map((_, i) => {
        const tenkan = periodMidpoint(bars, i, conversionPeriod);
        const kijun = periodMidpoint(bars, i, basePeriod);

        const sourceIndex = i - displacement;
        const senkouA =
            sourceIndex >= 0
                ? calculateSenkouA(
                      bars,
                      sourceIndex,
                      conversionPeriod,
                      basePeriod
                  )
                : null;
        const senkouB =
            sourceIndex >= 0
                ? periodMidpoint(bars, sourceIndex, spanBPeriod)
                : null;

        const chikouIndex = i + displacement;
        const chikou =
            chikouIndex < bars.length ? bars[chikouIndex].close : null;

        return { tenkan, kijun, senkouA, senkouB, chikou };
    });
}
