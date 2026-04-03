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

interface IchimokuCloudInput {
    senkouA: number | null;
    senkouB: number | null;
    tenkan?: number | null;
    kijun?: number | null;
    chikou?: number | null;
}

export function buildCloudData(
    ichimoku: IchimokuCloudInput[]
): IchimokuCloudPoint[] {
    return ichimoku.map((point: IchimokuCloudInput) => {
        const { senkouA, senkouB } = point;
        const isBullish =
            senkouA !== null && senkouB !== null && senkouA >= senkouB;
        const isBearish =
            senkouA !== null && senkouB !== null && senkouA < senkouB;
        const cloudUpper =
            senkouA !== null && senkouB !== null
                ? Math.max(senkouA, senkouB)
                : null;
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
