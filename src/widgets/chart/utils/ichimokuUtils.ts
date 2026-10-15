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
    return futureCloud.reduce(
        (
            acc: IchimokuCloudSeriesAccumulator,
            point: IchimokuCloudPoint,
            j: number
        ) => {
            const time = (lastTime + (j + 1) * interval) as UTCTimestamp;
            return {
                finalSenkouA: [
                    ...acc.finalSenkouA,
                    point.senkouA !== null
                        ? { time, value: point.senkouA }
                        : { time },
                ],
                finalSenkouB: [
                    ...acc.finalSenkouB,
                    point.senkouB !== null
                        ? { time, value: point.senkouB }
                        : { time },
                ],
                finalCloudBullish: [
                    ...acc.finalCloudBullish,
                    point.cloudBullishUpper !== null
                        ? { time, value: point.cloudBullishUpper }
                        : { time },
                ],
                finalCloudBearish: [
                    ...acc.finalCloudBearish,
                    point.cloudBearishUpper !== null
                        ? { time, value: point.cloudBearishUpper }
                        : { time },
                ],
            };
        },
        {
            finalSenkouA: base.senkouAData,
            finalSenkouB: base.senkouBData,
            finalCloudBullish: base.cloudBullishData,
            finalCloudBearish: base.cloudBearishData,
        }
    );
}

interface IchimokuCloudInput extends IchimokuFuturePoint {
    tenkan?: number | null;
    kijun?: number | null;
    chikou?: number | null;
}

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
