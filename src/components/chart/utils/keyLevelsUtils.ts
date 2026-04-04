import { LineSeries, LineStyle } from 'lightweight-charts';
import type {
    IChartApi,
    ISeriesApi,
    LineWidth,
    UTCTimestamp,
} from 'lightweight-charts';
import type { Bar } from '@/domain/types';

export function buildLineData(
    bars: Bar[],
    price: number
): { time: UTCTimestamp; value: number }[] {
    if (bars.length === 0) return [];
    return [
        { time: bars[0].time as UTCTimestamp, value: price },
        { time: bars[bars.length - 1].time as UTCTimestamp, value: price },
    ];
}

export function createLevelSeries(
    chart: IChartApi,
    color: string,
    lineWidth: LineWidth
): ISeriesApi<'Line'> {
    return chart.addSeries(LineSeries, {
        color,
        lineWidth,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: true,
    });
}
