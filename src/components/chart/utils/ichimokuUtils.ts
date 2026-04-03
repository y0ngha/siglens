import type { IchimokuFuturePoint } from '@/domain/types';
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
