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

/**
 * trend 방향이 dir과 일치하는 bar만 getValue(r) 값을, 나머지는 WhitespaceData({ time })를 반환한다.
 * 추세별 색 라인을 up/down(또는 long/short) 2개 LineSeries로 표현하기 위함(LineSeries는 per-point 색 미지원).
 * getValue 선택자와 제네릭 Dir로 supertrend·parabolicSar(단일 값 필드)와 chandelier(추세별 longStop/shortStop)를 모두 지원한다.
 */
export function buildTrendSplitData<
    Dir extends string,
    T extends { trend: string | null },
>(
    bars: Bar[],
    data: T[],
    dir: Dir,
    getValue: (r: T) => number | null
): SeriesPoint[] {
    const count = Math.min(bars.length, data.length);
    // Bar.time은 epoch seconds 정수 — LWC UTCTimestamp(branded number)와 런타임 형태 동일하므로 아래 두 cast 모두 안전.
    return bars.slice(0, count).map((bar, i) => {
        const r = data[i];
        if (r && r.trend === dir) {
            const value = getValue(r);
            if (value !== null) {
                return { time: bar.time as UTCTimestamp, value };
            }
        }
        return { time: bar.time as UTCTimestamp };
    });
}
