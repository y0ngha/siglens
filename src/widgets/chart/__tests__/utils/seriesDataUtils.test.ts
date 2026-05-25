import type { Bar } from '@y0ngha/siglens-core';
import type { UTCTimestamp } from 'lightweight-charts';
import {
    buildSeriesData,
    buildSeriesDataFromValues,
} from '@/widgets/chart/utils/seriesDataUtils';

const mockBars: Bar[] = [
    { time: 100, open: 10, high: 15, low: 9, close: 12, volume: 1000 },
    { time: 200, open: 12, high: 18, low: 11, close: 15, volume: 1200 },
    { time: 300, open: 15, high: 20, low: 14, close: 18, volume: 1100 },
];

describe('buildSeriesData', () => {
    it('maps indicator values to series points with time from bars', () => {
        const indicatorData = [{ rsi: 70 }, { rsi: 65 }, { rsi: 80 }];

        const result = buildSeriesData(mockBars, indicatorData, 'rsi');

        expect(result).toEqual([
            { time: 100 as UTCTimestamp, value: 70 },
            { time: 200 as UTCTimestamp, value: 65 },
            { time: 300 as UTCTimestamp, value: 80 },
        ]);
    });

    it('produces WhitespaceData for null values', () => {
        const indicatorData = [{ rsi: 70 }, { rsi: null }, { rsi: 80 }];

        const result = buildSeriesData(mockBars, indicatorData, 'rsi');

        expect(result[1]).toEqual({ time: 200 as UTCTimestamp });
        expect(result[1]).not.toHaveProperty('value');
    });

    it('produces WhitespaceData for undefined values', () => {
        const indicatorData = [{ rsi: 70 }, { rsi: undefined }, { rsi: 80 }];

        const result = buildSeriesData(mockBars, indicatorData, 'rsi');

        expect(result[1]).toEqual({ time: 200 as UTCTimestamp });
    });

    it('uses Math.min(bars, indicatorData) for length', () => {
        const indicatorData = [{ rsi: 70 }];

        const result = buildSeriesData(mockBars, indicatorData, 'rsi');

        expect(result).toHaveLength(1);
    });

    it('returns empty array for empty bars', () => {
        expect(buildSeriesData([], [{ rsi: 70 }], 'rsi')).toEqual([]);
    });

    it('returns empty array for empty indicator data', () => {
        expect(buildSeriesData(mockBars, [], 'rsi')).toEqual([]);
    });

    it('applies colorFn when provided', () => {
        const indicatorData = [{ val: 10 }, { val: -5 }];
        const colorFn = (value: number) => (value >= 0 ? '#00ff00' : '#ff0000');

        const result = buildSeriesData(mockBars, indicatorData, 'val', colorFn);

        expect(result[0]).toEqual({
            time: 100 as UTCTimestamp,
            value: 10,
            color: '#00ff00',
        });
        expect(result[1]).toEqual({
            time: 200 as UTCTimestamp,
            value: -5,
            color: '#ff0000',
        });
    });

    it('does not add color when colorFn is undefined', () => {
        const indicatorData = [{ val: 10 }];

        const result = buildSeriesData(mockBars, indicatorData, 'val');

        expect(result[0]).not.toHaveProperty('color');
    });
});

describe('buildSeriesDataFromValues', () => {
    it('maps values array to series points with time from bars', () => {
        const values = [100, 200, 300];

        const result = buildSeriesDataFromValues(mockBars, values);

        expect(result).toEqual([
            { time: 100 as UTCTimestamp, value: 100 },
            { time: 200 as UTCTimestamp, value: 200 },
            { time: 300 as UTCTimestamp, value: 300 },
        ]);
    });

    it('produces WhitespaceData for null values', () => {
        const values = [100, null, 300];

        const result = buildSeriesDataFromValues(mockBars, values);

        expect(result[1]).toEqual({ time: 200 as UTCTimestamp });
        expect(result[1]).not.toHaveProperty('value');
    });

    it('uses Math.min(bars, values) for length', () => {
        const values = [100];

        const result = buildSeriesDataFromValues(mockBars, values);

        expect(result).toHaveLength(1);
    });

    it('returns empty array for empty bars', () => {
        expect(buildSeriesDataFromValues([], [100])).toEqual([]);
    });

    it('returns empty array for empty values', () => {
        expect(buildSeriesDataFromValues(mockBars, [])).toEqual([]);
    });

    it('handles all null values', () => {
        const values = [null, null, null];

        const result = buildSeriesDataFromValues(mockBars, values);

        expect(result).toHaveLength(3);
        result.forEach(point => {
            expect(point).not.toHaveProperty('value');
        });
    });
});
