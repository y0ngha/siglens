import type { IChartApi, ISeriesApi, SeriesType } from 'lightweight-charts';
import { TRANSPARENT_COLOR as TRANSPARENT } from '../constants';

/**
 * 지표 시리즈(선·영역)가 프리·애프터마켓 구간에서 **끊겨 보이게** 하는 차트 어댑터.
 *
 * 지표는 정규장 봉에서만 계산돼 정규장 시각에만 점이 있다. 시간축에는 시간외 봉이 끼어 있으므로, 점을
 * 그대로 두면 선이 시간외 구간을 가로지르는 직선으로 이어져(RSI 등) 존재하지 않는 값을 암시한다.
 *
 * 값 없는 점(`{ time }`, whitespace)을 끼우는 방법은 **통하지 않는다** — lightweight-charts는 whitespace
 * 행을 그리기 전에 걸러 내고 인접한 유효 점끼리 잇는다(2026-10-15 실물 차트 + 렌더러 소스로 확인).
 *
 * **공개 API가 아닌 렌더러 동작에 기댄다 — lightweight-charts를 올릴 때 다시 확인한다(TOOLCHAIN.md#TC-37, 확인한
 * 버전: 5.2.1).**
 *
 * 대신 **구간을 잇는 선분을 투명하게** 칠한다. lightweight-charts 5.2의 `walkLine`은 점 `i-1 → i` 선분을
 * `i-1` 점의 점별 스타일(`color`)로 칠한다(스타일이 바뀌는 점에서 이전 스타일로 경로를 마무리한다). 그래서
 * 시간외 구간을 건너는 두 정규장 점 중 **앞 점**에 투명 색을 주면 그 선분만 안 보이고, 시리즈는 하나로
 * 남는다 — 구간마다 시리즈를 늘리지 않으므로 시리즈 수 상한도, 타임프레임별 예외(4시간봉 등)도 없다.
 * 영역 시리즈(볼린저 배경·일목 구름)는 `lineColor`·`topColor`·`bottomColor`를 함께 투명하게 한다.
 *
 * **선이 안 보이는 시리즈는 건드리지 않는다**(`lineVisible: false` — 파라볼릭 SAR 점, 스퀴즈 상태 점). 이
 * 시리즈는 선 대신 점 마커를 그리는데, 마커도 같은 점별 스타일을 쓴다(`drawSeriesPointMarkers`). 투명을 입히면
 * 시간외 구간 직전 정규장 봉의 **실제 점이 사라진다**. 이어 붙일 선이 없으니 끊을 이유도 없다.
 *
 * 투명 점에서 **크로스헤어 마커**도 투명해지는 것을 막으려고(`crosshairMarkerBackgroundColor`가 비어 있으면
 * 마커 배경이 점별 색을 따른다) 시리즈 자신의 선 색을 마커 배경으로 고정한다 — 투명 점이 생길 수 있는 선이
 * 보이는 시리즈에서만. 선이 안 보이는 시리즈는 점별 색이 곧 마커 색이라(스퀴즈 상태 점) 건드리지 않는다.
 * 호출부가 명시한 값은 존중하고, 이후 `applyOptions`로 선 색이 바뀌면 따라가며, `lineVisible`이 뒤집히면
 * 마커 전용이 되는 쪽에서 고정을 풀어 `''`로 되돌린다.
 *
 * 호출처 30여 곳의 빌더를 고치지 않으려고 **차트 API 앞단**에서 처리한다: 지표 훅에만 이 어댑터가 감싼
 * 차트를 주면(`createExtendedGapController().wrap`), 거기서 만든 선·영역 시리즈의 `setData`가 점별 색을
 * 입혀 실제 시리즈로 넘긴다. 추세선·작도 레벨(`useChartOverlays`)과 primitive가 쓰는 진짜 차트에는 영향이
 * 없어 2점짜리 선은 계속 이어진다.
 */

interface TimedPoint {
    time: unknown;
    value?: unknown;
}

/** 끊을 필요가 있는 시리즈 종류(점끼리 잇는 선·영역). 히스토그램 등은 이어질 선이 없다. */
const BREAKABLE_TYPES: readonly SeriesType[] = ['Line', 'Area'];

/** 시리즈 종류별로 "이 점에서 출발하는 선분을 안 보이게" 하는 점별 스타일. */
function hiddenSegmentStyle(type: SeriesType): Record<string, string> {
    return type === 'Area'
        ? {
              lineColor: TRANSPARENT,
              topColor: TRANSPARENT,
              bottomColor: TRANSPARENT,
          }
        : { color: TRANSPARENT };
}

/**
 * 값이 있는 인접한 두 점 **사이에** `gapTimes`(시각 오름차순)가 하나라도 있으면, 그 앞 점을 투명 스타일로
 * 바꾼 새 배열을 돌려준다(입력은 건드리지 않는다). 값 없는 점(워밍업)은 그대로 둔다. 바꿀 점이 없으면
 * 입력 배열 자신이다. 시각이 숫자가 아니면 손대지 않는다.
 */
export function hideSegmentsAcrossGaps<T extends TimedPoint>(
    data: readonly T[],
    gapTimes: readonly number[],
    style: Record<string, string>
): T[] {
    // `readonly T[]` → `T[]`: 입력을 돌려주기만 하고 이 함수는 입력을 변경하지 않는다.
    if (data.length < 2 || gapTimes.length === 0) return data as T[];
    // 점 수(수백~천 개) × 시리즈 수만큼 setData마다 돌므로 O(N) 단일 순회 + 필요할 때만 복사(copy-on-write)한다.
    let out: T[] | null = null;
    let g = 0;
    let previousIndex = -1;
    for (let i = 0; i < data.length; i += 1) {
        const point = data[i]!;
        if (typeof point.time !== 'number') return data as T[];
        if (point.value === undefined) continue;
        if (previousIndex >= 0) {
            // 앞선 반복에서 `typeof time === 'number'`를 이미 확인한 점이다.
            const previous = data[previousIndex]!.time as number;
            while (g < gapTimes.length && gapTimes[g]! <= previous) g += 1;
            if (g < gapTimes.length && gapTimes[g]! < point.time) {
                out ??= data.slice();
                out[previousIndex] = { ...data[previousIndex]!, ...style };
            }
        }
        previousIndex = i;
    }
    return out ?? (data as T[]);
}

export interface ExtendedGapController {
    /** 이 차트에서 만드는 선·영역 시리즈를 시간외 구간에서 끊어 보이게 하는 차트 어댑터. `null`이면 `null`. 같은 차트는 같은 어댑터. */
    wrap: (chart: IChartApi | null) => IChartApi | null;
    /** 끊을 시각(시간외 봉의 시각, 오름차순)을 바꾸고 이미 그려진 시리즈를 다시 채운다. */
    setGapTimes: (times: readonly number[]) => void;
}

interface Entry {
    real: ISeriesApi<SeriesType>;
    raw: readonly TimedPoint[] | null;
    /** 크로스헤어 마커 배경을 우리가 관리해도 되는가(호출부가 명시하지 않은 경우). */
    autoMarker: boolean;
    /** 지금 우리가 마커 배경을 선 색으로 **고정해 둔** 상태인가(되돌릴 때 `''`로 복원한다). */
    pinned: boolean;
}

interface LineLikeOptions {
    color?: string;
    lineColor?: string;
    lineVisible?: boolean;
    crosshairMarkerBackgroundColor?: string;
}

type SetData = (data: readonly unknown[]) => void;

export function createExtendedGapController(): ExtendedGapController {
    let gapTimes: readonly number[] = [];
    const entries = new Set<Entry>();
    const wrappedCharts = new WeakMap<IChartApi, IChartApi>();
    const entryOfWrapper = new WeakMap<object, Entry>();

    /**
     * 크로스헤어 마커 배경을 시리즈 자신의 선 색으로 맞춘다 — **투명 점을 가질 수 있는 시리즈에서만**
     * (우리가 관리할 때, 선이 보일 때). 선이 안 보이는 시리즈(`lineVisible:false`)는 점별 색이 곧 마커 색이라
     * (스퀴즈 상태 점) 고정하면 호버 마커가 기본색으로 바뀐다. `lineVisible`이 `applyOptions`로 뒤집혀도
     * 양방향으로 따라간다: 마커 전용이 되면 우리가 고정했던 값을 `''`로 되돌린다.
     */
    const syncMarkerColor = (entry: Entry): void => {
        if (!entry.autoMarker) return;
        // 선·영역 시리즈 옵션의 부분 집합만 읽는다(다른 종류는 `BREAKABLE_TYPES`가 거른다).
        const options = entry.real.options() as LineLikeOptions;
        if (options.lineVisible === false) {
            if (entry.pinned) {
                entry.real.applyOptions({ crosshairMarkerBackgroundColor: '' });
                entry.pinned = false;
            }
            return;
        }
        const color =
            entry.real.seriesType() === 'Area'
                ? options.lineColor
                : options.color;
        if (typeof color === 'string' && color !== '') {
            entry.real.applyOptions({ crosshairMarkerBackgroundColor: color });
            entry.pinned = true;
        }
    };

    const applyData = (entry: Entry): void => {
        if (entry.raw === null) return;
        const type = entry.real.seriesType();
        const lineVisible =
            // 선·영역 시리즈 옵션의 부분 집합(`lineVisible`)만 읽는다.
            (entry.real.options() as LineLikeOptions).lineVisible !== false;
        const data =
            BREAKABLE_TYPES.includes(type) && lineVisible
                ? hideSegmentsAcrossGaps(
                      entry.raw,
                      gapTimes,
                      hiddenSegmentStyle(type)
                  )
                : entry.raw;
        // 시리즈 종류별 `setData` 인자 타입이 달라 하나로 좁히지 못한다 — 런타임은 같은 점 배열이다.
        (entry.real.setData as SetData)(data);
    };

    const wrapSeries = (
        real: ISeriesApi<SeriesType>
    ): ISeriesApi<SeriesType> => {
        const entry: Entry = {
            real,
            raw: null,
            autoMarker: false,
            pinned: false,
        };
        entry.autoMarker =
            BREAKABLE_TYPES.includes(real.seriesType()) &&
            // 선·영역 시리즈 옵션의 부분 집합만 읽는다.
            (real.options() as LineLikeOptions)
                .crosshairMarkerBackgroundColor === '';
        syncMarkerColor(entry);
        entries.add(entry);
        const wrapper = new Proxy(real, {
            get(target, prop) {
                if (prop === 'setData') {
                    return (data: readonly TimedPoint[]) => {
                        entry.raw = data;
                        applyData(entry);
                    };
                }
                if (prop === 'applyOptions') {
                    return (options: Record<string, unknown>) => {
                        // 호출부가 마커 배경을 직접 정했다면 그 값을 존중한다.
                        if ('crosshairMarkerBackgroundColor' in options) {
                            entry.autoMarker = false;
                            entry.pinned = false;
                        }
                        // Proxy 안에서 종류별 옵션 타입을 모른다 — 받은 옵션을 그대로 넘긴다.
                        (target.applyOptions as (o: unknown) => void)(options);
                        syncMarkerColor(entry);
                    };
                }
                const value: unknown = Reflect.get(target, prop);
                // `typeof === 'function'`을 확인한 값이라 호출 가능하다(메서드를 시리즈에 묶어 전달).
                return typeof value === 'function'
                    ? (value as (...a: unknown[]) => unknown).bind(target)
                    : value;
            },
        });
        entryOfWrapper.set(wrapper, entry);
        return wrapper;
    };

    const wrapChart = (chart: IChartApi): IChartApi =>
        new Proxy(chart, {
            get(target, prop) {
                if (prop === 'addSeries') {
                    // 종류별 `addSeries` 오버로드를 하나로 좁히지 못해 인자를 그대로 전달한다.
                    return (...args: unknown[]) =>
                        wrapSeries(
                            (
                                target.addSeries as (
                                    ...a: unknown[]
                                ) => ISeriesApi<SeriesType>
                            )(...args)
                        );
                }
                if (prop === 'removeSeries') {
                    return (series: ISeriesApi<SeriesType>) => {
                        const entry = entryOfWrapper.get(series);
                        if (entry !== undefined) entries.delete(entry);
                        target.removeSeries(entry?.real ?? series);
                    };
                }
                const value: unknown = Reflect.get(target, prop);
                // `typeof === 'function'`을 확인한 값이라 호출 가능하다.
                return typeof value === 'function'
                    ? (value as (...a: unknown[]) => unknown).bind(target)
                    : value;
            },
        });

    return {
        wrap: chart => {
            if (chart === null) return null;
            let wrapped = wrappedCharts.get(chart);
            if (wrapped === undefined) {
                wrapped = wrapChart(chart);
                wrappedCharts.set(chart, wrapped);
            }
            return wrapped;
        },
        setGapTimes: times => {
            gapTimes = times;
            for (const entry of entries) {
                try {
                    applyData(entry);
                } catch {
                    // 차트가 이미 제거됐다 — 시리즈도 함께 사라졌다.
                    entries.delete(entry);
                }
            }
        },
    };
}
