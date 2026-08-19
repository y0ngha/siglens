import type { Bar } from '@y0ngha/siglens-core';
import type { UTCTimestamp } from 'lightweight-charts';

export type SeriesPoint =
    | { time: UTCTimestamp; value: number; color?: string }
    | { time: UTCTimestamp };

/**
 * bars와 지표 배열의 정렬 규약. 이 파일 밖(`candlestickDataUtils`, `useVolumeChartData`)에서도
 * 같은 규약을 써야 하므로 export한다 — **세 곳에서 따로 구현하면 반드시 어긋난다**.
 *
 * ## 규약
 *
 * | 관계 | 정렬 | 이유 |
 * |---|---|---|
 * | 같은 길이 | 동일(무동작) | 프로덕션의 정상 상태 |
 * | 지표가 **짧음** | **tail**(최신 봉 쪽) | 워밍업 결측이 앞쪽이라 유효 구간은 끝 |
 * | 지표가 **김** | **좌측** | 초과분은 과거가 아니라 **미래 투영**(일목균형표 선행스팬) |
 *
 * ## 왜 생겼나
 *
 * 예전엔 `bars.slice(0, count)` + `data[i]`로 앞에서부터 짝지었다. 두 배열 길이가 항상
 * 같다는 암묵 전제 위에 선 코드였고, 프로덕션에선 실제로 늘 같아서 **한 번도 발동하지 않는
 * 죽은 방어 코드**였다(core `calculateIndicators`는 봉과 같은 길이로 반환하고 워밍업을
 * 앞쪽 null로 채운다). RSC seed가 지표를 접기 시작하면서 처음으로 길이가 갈렸고, 그 순간
 * 좌측 정렬이 틀렸음이 드러났다 — 봉 501개에 값 1개가 **가장 오래된 봉**(2020-09-13)에
 * 최신 값(2022-01-26)을 찍었다.
 */
function alignsLeft(barsLength: number, dataLength: number): boolean {
    return dataLength > barsLength;
}

/**
 * **전체 bars를 순회하는** 호출부용 — bar 인덱스 `i`에 더하면 지표 인덱스가 된다.
 * 지표가 짧으면 음수라 앞쪽 bar는 `undefined`로 떨어진다(그 bar엔 지표가 없는 게 맞다).
 * bars의 부분집합만 그리는 호출부는 대신 {@link tailAligned}를 쓴다.
 */
export function tailOffset(barsLength: number, dataLength: number): number {
    return alignsLeft(barsLength, dataLength) ? 0 : dataLength - barsLength;
}

/**
 * 지표와 짝이 맞는 bars 구간만 돌려준다. 반환된 `tail`의 인덱스 `i`가 곧 `data[i]`다
 * (offset이 따로 필요 없다 — 짧은 쪽 길이로 자르므로 양쪽 시작점이 맞춰진다).
 *
 * `count === 0`을 따로 처리하는 이유: `slice(-0)`은 `slice(0)`과 같아 **배열 전체**를
 * 돌려준다. 그대로 두면 빈 지표에 봉 전체가 짝지어져 정반대 결과가 난다.
 */
export function tailAligned<T>(bars: Bar[], data: readonly T[]): Bar[] {
    const count = Math.min(bars.length, data.length);
    if (count === 0) return [];
    if (alignsLeft(bars.length, data.length)) return bars;
    return bars.slice(-count);
}

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
    // 3번째 인자(index)는 두지 않는다. 호출부 30곳 중 colorFn을 쓰는 4곳이 전부
    // `(value)` 또는 `(value, row)`만 받는 죽은 유연성이었고, tail 정렬 도입으로
    // **의미까지 조용히 바뀌었다**(지표 배열 인덱스 → tail 인덱스). 다음 사람이
    // 옛 의미로 쓰기 전에 없앤다.
    colorFn?: (value: number, row: T) => string
): SeriesPoint[] {
    return tailAligned(bars, indicatorData).map((bar, i) => {
        const value = indicatorData[i]?.[key];
        if (value === null || value === undefined) {
            return { time: bar.time as UTCTimestamp };
        }
        const point: { time: UTCTimestamp; value: number; color?: string } = {
            time: bar.time as UTCTimestamp,
            value,
        };
        if (colorFn !== undefined) {
            point.color = colorFn(value, indicatorData[i]);
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
    return tailAligned(bars, values).map((bar, i) => {
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
    // Bar.time은 epoch seconds 정수 — LWC UTCTimestamp(branded number)와 런타임 형태 동일하므로 아래 두 cast 모두 안전.
    return tailAligned(bars, data).map((bar, i) => {
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

/**
 * 각 bar에 0(zero)라인 위 점({ time, value: 0, color })을 만든다. colorFn이 null을
 * 반환하거나 행이 없으면 해당 bar는 whitespace(점 없음). Squeeze 상태 점처럼 값과
 * 무관하게 0라인에 상태 색을 찍는 용도.
 */
export function buildZeroLineDots<T>(
    bars: Bar[],
    data: T[],
    colorFn: (row: T) => string | null
): SeriesPoint[] {
    return tailAligned(bars, data).map((bar, i) => {
        const row = data[i];
        const color = row == null ? null : colorFn(row);
        if (color === null) {
            return { time: bar.time as UTCTimestamp };
        }
        return { time: bar.time as UTCTimestamp, value: 0, color };
    });
}
