import type { Bar, IchimokuFuturePoint } from '@y0ngha/siglens-core';
import type { UTCTimestamp } from 'lightweight-charts';
import type { SeriesPoint } from '@/components/chart/utils/seriesDataUtils';

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

export function extendWithFutureCloud(
    bars: Bar[],
    futureCloud: IchimokuCloudPoint[],
    base: FutureCloudBase
): IchimokuCloudSeriesAccumulator {
    const lastTime = bars[bars.length - 1].time;
    const interval = lastTime - bars[bars.length - 2].time;
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
