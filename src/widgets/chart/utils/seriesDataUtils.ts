import type { Bar } from '@y0ngha/siglens-core';
import type { UTCTimestamp } from 'lightweight-charts';

export type SeriesPoint =
    | { time: UTCTimestamp; value: number; color?: string }
    | { time: UTCTimestamp };

/**
 * bars와 indicator 배열을 lightweight-charts용 시리즈 데이터로 변환한다.
 * null/undefined 값은 WhitespaceData({ time }) 형태로, 유효한 값은
 * SingleValueData({ time, value }) 형태로 반환한다.
 * colorFn을 전달하면 각 포인트에 color 필드를 추가한다 (히스토그램 등에 활용).
 */
export function buildSeriesData<
    K extends string,
    T extends Record<K, number | null | undefined>,
>(
    bars: Bar[],
    indicatorData: T[],
    key: K,
    colorFn?: (value: number) => string
): SeriesPoint[] {
    const count = Math.min(bars.length, indicatorData.length);
    return bars.slice(0, count).map((bar, i) => {
        const value = indicatorData[i]?.[key];
        if (value === null || value === undefined) {
            return { time: bar.time as UTCTimestamp };
        }
        const point: { time: UTCTimestamp; value: number; color?: string } = {
            time: bar.time as UTCTimestamp,
            value,
        };
        if (colorFn !== undefined) {
            point.color = colorFn(value);
        }
        return point;
    });
}

/**
 * bars와 (number | null)[] 형태의 단순 값 배열을 lightweight-charts용 시리즈 데이터로 변환한다.
 * null/undefined 값은 WhitespaceData({ time }) 형태로, 유효한 값은
 * SingleValueData({ time, value }) 형태로 반환한다.
 * RSI, MA, EMA 등 단일 숫자 배열 인디케이터에 사용한다.
 */
export function buildSeriesDataFromValues(
    bars: Bar[],
    values: (number | null)[]
): SeriesPoint[] {
    const count = Math.min(bars.length, values.length);
    return bars.slice(0, count).map((bar, i) => {
        const value = values[i];
        if (value === null || value === undefined) {
            return { time: bar.time as UTCTimestamp };
        }
        return { time: bar.time as UTCTimestamp, value };
    });
}
