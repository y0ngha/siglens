/**
 * 일목균형표 표시 데이터 — 구름 상·하단 분리와 선행 구름 미래 점 연장.
 */
import type { Bar, IchimokuFuturePoint } from '@y0ngha/siglens-core';
import type { UTCTimestamp } from 'lightweight-charts';
import type { SeriesPoint } from './seriesDataUtils';

export interface IchimokuCloudPoint {
    tenkan: number | null;
    kijun: number | null;
    senkouA: number | null;
    senkouB: number | null;
    cloudBullishUpper: number | null;
    cloudBearishUpper: number | null;
    chikou: number | null;
}

export interface IchimokuCloudSeriesAccumulator {
    finalSenkouA: SeriesPoint[];
    finalSenkouB: SeriesPoint[];
    finalCloudBullish: SeriesPoint[];
    finalCloudBearish: SeriesPoint[];
}

export interface FutureCloudBase {
    senkouAData: SeriesPoint[];
    senkouBData: SeriesPoint[];
    cloudBullishData: SeriesPoint[];
    cloudBearishData: SeriesPoint[];
}

/**
 * 선행 구름 미래 점을 끝에 이어 붙인다. 간격은 `bars`의 마지막 두 봉에서 구하고, 시작 시각은
 * `anchorTime`(생략 시 마지막 봉) — 시간외 봉이 `bars`(정규장) 뒤에 그려질 때 구름이 그 캔들
 * 오른쪽에서 시작하도록 더 늦은 시각을 줄 수 있다. 앞당기지는 않는다(`Math.max`).
 */
export function extendWithFutureCloud(
    bars: Bar[],
    futureCloud: IchimokuCloudPoint[],
    base: FutureCloudBase,
    anchorTime?: number
): IchimokuCloudSeriesAccumulator {
    const barsLastTime = bars[bars.length - 1].time;
    const interval = barsLastTime - bars[bars.length - 2].time;
    const lastTime = Math.max(barsLastTime, anchorTime ?? barsLastTime);
    const timeAt = (j: number) =>
        (lastTime + (j + 1) * interval) as UTCTimestamp;
    // 필드마다 미래 점을 한 번에 만들어 이어 붙인다 — 점마다 기존 배열을 복사하던
    // reduce는 O(N·K)였다.
    const futurePoints = (
        valueOf: (point: IchimokuCloudPoint) => number | null
    ): SeriesPoint[] =>
        futureCloud.map((point, j) => {
            const value = valueOf(point);
            return value !== null
                ? { time: timeAt(j), value }
                : { time: timeAt(j) };
        });

    return {
        finalSenkouA: base.senkouAData.concat(futurePoints(p => p.senkouA)),
        finalSenkouB: base.senkouBData.concat(futurePoints(p => p.senkouB)),
        finalCloudBullish: base.cloudBullishData.concat(
            futurePoints(p => p.cloudBullishUpper)
        ),
        finalCloudBearish: base.cloudBearishData.concat(
            futurePoints(p => p.cloudBearishUpper)
        ),
    };
}

interface IchimokuCloudInput extends IchimokuFuturePoint {
    tenkan?: number | null;
    kijun?: number | null;
    chikou?: number | null;
}

/** core 일목 결과를 구름 색(상승·하락) 분리 상단값이 붙은 표시 점으로 바꾼다. */
export function buildCloudData(
    ichimoku: IchimokuCloudInput[]
): IchimokuCloudPoint[] {
    return ichimoku.map((point: IchimokuCloudInput) => {
        const { senkouA, senkouB } = point;
        const hasValues = senkouA !== null && senkouB !== null;
        const isBullish = hasValues && senkouA >= senkouB;
        const isBearish = hasValues && senkouA < senkouB;
        const cloudUpper = hasValues ? Math.max(senkouA, senkouB) : null;
        return {
            tenkan: point.tenkan ?? null,
            kijun: point.kijun ?? null,
            senkouA,
            senkouB,
            cloudBullishUpper: isBullish ? cloudUpper : null,
            cloudBearishUpper: isBearish ? cloudUpper : null,
            chikou: point.chikou ?? null,
        };
    });
}
