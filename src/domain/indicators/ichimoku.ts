import type { Bar, IchimokuFuturePoint, IchimokuResult } from '@/domain/types';
import {
    ICHIMOKU_BASE_PERIOD,
    ICHIMOKU_CONVERSION_PERIOD,
    ICHIMOKU_DISPLACEMENT,
    ICHIMOKU_SPAN_B_PERIOD,
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

    return bars.map((_, i) => {
        const tenkan = periodMidpoint(bars, i, conversionPeriod);
        const kijun = periodMidpoint(bars, i, basePeriod);

        const sourceIndex = i - displacement;
        const isSourceIndexValid = 0 <= sourceIndex;
        const senkouA = isSourceIndexValid
            ? calculateSenkouA(bars, sourceIndex, conversionPeriod, basePeriod)
            : null;
        const senkouB = isSourceIndexValid
            ? periodMidpoint(bars, sourceIndex, spanBPeriod)
            : null;

        const chikouIndex = i + displacement;
        const chikou =
            chikouIndex < bars.length ? bars[chikouIndex].close : null;

        return { tenkan, kijun, senkouA, senkouB, chikou };
    });
}

/**
 * bars의 마지막 displacement 구간에 해당하는 미래 선행스팬(Senkou Span A·B) 값을 반환한다.
 * Ichimoku 표준 명세에 따라 선행스팬은 displacement봉 앞(미래)에 투영되므로,
 * 현재 시점 이후 displacement개의 미래 포인트에 대한 값을 별도로 계산해야 한다.
 */
export function calculateIchimokuFutureCloud(
    bars: Bar[],
    conversionPeriod = ICHIMOKU_CONVERSION_PERIOD,
    basePeriod = ICHIMOKU_BASE_PERIOD,
    spanBPeriod = ICHIMOKU_SPAN_B_PERIOD,
    displacement = ICHIMOKU_DISPLACEMENT
): IchimokuFuturePoint[] {
    if (bars.length === 0) return [];
    return Array.from({ length: displacement }, (_, j) => {
        const sourceIndex = bars.length - displacement + j;
        const senkouA = calculateSenkouA(
            bars,
            sourceIndex,
            conversionPeriod,
            basePeriod
        );
        const senkouB = periodMidpoint(bars, sourceIndex, spanBPeriod);
        return { senkouA, senkouB };
    });
}
