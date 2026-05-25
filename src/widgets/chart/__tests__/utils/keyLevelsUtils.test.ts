import type { Bar } from '@y0ngha/siglens-core';
import type { UTCTimestamp } from 'lightweight-charts';
import {
    buildLineData,
    createLevelSeries,
} from '@/widgets/chart/utils/keyLevelsUtils';

vi.mock('lightweight-charts', () => ({
    LineSeries: 'LineSeries',
    LineStyle: { Dashed: 2 },
}));

const mockBars: Bar[] = [
    { time: 100, open: 10, high: 15, low: 9, close: 12, volume: 1000 },
    { time: 200, open: 12, high: 18, low: 11, close: 15, volume: 1200 },
    { time: 300, open: 15, high: 20, low: 14, close: 18, volume: 1100 },
];

describe('buildLineData', () => {
    it('returns first and last bar times with the given price', () => {
        const result = buildLineData(mockBars, 150);

        expect(result).toEqual([
            { time: 100 as UTCTimestamp, value: 150 },
            { time: 300 as UTCTimestamp, value: 150 },
        ]);
    });

    it('returns empty array for empty bars', () => {
        expect(buildLineData([], 100)).toEqual([]);
    });

    it('returns two identical-time points for single bar', () => {
        const singleBar: Bar[] = [
            {
                time: 500,
                open: 10,
                high: 15,
                low: 9,
                close: 12,
                volume: 100,
            },
        ];

        const result = buildLineData(singleBar, 42);

        expect(result).toHaveLength(2);
        expect(result[0].time).toBe(result[1].time);
        expect(result[0].value).toBe(42);
    });
});

describe('createLevelSeries', () => {
    it('calls chart.addSeries with LineSeries and correct options', () => {
        const mockSeries = { setData: vi.fn() };
        const mockChart = {
            addSeries: vi.fn(() => mockSeries),
        };

        const result = createLevelSeries(
            mockChart as never,
            '#ff0000',
            2 as never
        );

        expect(mockChart.addSeries).toHaveBeenCalledWith('LineSeries', {
            color: '#ff0000',
            lineWidth: 2,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: true,
        });
        expect(result).toBe(mockSeries);
    });
});
