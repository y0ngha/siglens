import type { Bar } from '@y0ngha/siglens-core';
import type { UTCTimestamp } from 'lightweight-charts';
import {
    buildCloudData,
    extendWithFutureCloud,
    type FutureCloudBase,
    type IchimokuCloudPoint,
} from '@/widgets/chart/utils/ichimokuUtils';

const mockBars: Bar[] = [
    { time: 100, open: 10, high: 15, low: 9, close: 12, volume: 1000 },
    { time: 200, open: 12, high: 18, low: 11, close: 15, volume: 1200 },
    { time: 300, open: 15, high: 20, low: 14, close: 18, volume: 1100 },
];

describe('buildCloudData', () => {
    it('returns bullish cloud when senkouA >= senkouB', () => {
        const input = [{ senkouA: 110, senkouB: 100 }];

        const result = buildCloudData(input);

        expect(result).toHaveLength(1);
        expect(result[0].senkouA).toBe(110);
        expect(result[0].senkouB).toBe(100);
        expect(result[0].cloudBullishUpper).toBe(110);
        expect(result[0].cloudBearishUpper).toBeNull();
    });

    it('returns bearish cloud when senkouA < senkouB', () => {
        const input = [{ senkouA: 90, senkouB: 100 }];

        const result = buildCloudData(input);

        expect(result[0].cloudBullishUpper).toBeNull();
        expect(result[0].cloudBearishUpper).toBe(100);
    });

    it('returns null cloud values when senkouA is null', () => {
        const input = [{ senkouA: null, senkouB: 100 }];

        const result = buildCloudData(input);

        expect(result[0].cloudBullishUpper).toBeNull();
        expect(result[0].cloudBearishUpper).toBeNull();
    });

    it('returns null cloud values when senkouB is null', () => {
        const input = [{ senkouA: 100, senkouB: null }];

        const result = buildCloudData(input);

        expect(result[0].cloudBullishUpper).toBeNull();
        expect(result[0].cloudBearishUpper).toBeNull();
    });

    it('maps tenkan, kijun, chikou with defaults when absent', () => {
        const input = [{ senkouA: 100, senkouB: 90 }];

        const result = buildCloudData(input);

        expect(result[0].tenkan).toBeNull();
        expect(result[0].kijun).toBeNull();
        expect(result[0].chikou).toBeNull();
    });

    it('preserves tenkan, kijun, chikou when provided', () => {
        const input = [
            {
                senkouA: 100,
                senkouB: 90,
                tenkan: 95,
                kijun: 98,
                chikou: 88,
            },
        ];

        const result = buildCloudData(input);

        expect(result[0].tenkan).toBe(95);
        expect(result[0].kijun).toBe(98);
        expect(result[0].chikou).toBe(88);
    });

    it('returns equal cloud when senkouA equals senkouB (treated as bullish)', () => {
        const input = [{ senkouA: 100, senkouB: 100 }];

        const result = buildCloudData(input);

        expect(result[0].cloudBullishUpper).toBe(100);
        expect(result[0].cloudBearishUpper).toBeNull();
    });

    it('handles empty array', () => {
        expect(buildCloudData([])).toEqual([]);
    });

    it('processes multiple points', () => {
        const input = [
            { senkouA: 110, senkouB: 100 },
            { senkouA: 90, senkouB: 100 },
            { senkouA: null, senkouB: null },
        ];

        const result = buildCloudData(input);

        expect(result).toHaveLength(3);
        expect(result[0].cloudBullishUpper).toBe(110);
        expect(result[1].cloudBearishUpper).toBe(100);
        expect(result[2].cloudBullishUpper).toBeNull();
        expect(result[2].cloudBearishUpper).toBeNull();
    });
});

describe('extendWithFutureCloud', () => {
    const emptyBase: FutureCloudBase = {
        senkouAData: [],
        senkouBData: [],
        cloudBullishData: [],
        cloudBearishData: [],
    };

    it('appends future cloud points with correct timestamps', () => {
        const futureCloud: IchimokuCloudPoint[] = [
            {
                tenkan: null,
                kijun: null,
                senkouA: 105,
                senkouB: 100,
                cloudBullishUpper: 105,
                cloudBearishUpper: null,
                chikou: null,
            },
        ];

        const result = extendWithFutureCloud(mockBars, futureCloud, emptyBase);

        const expectedTime = (300 + 100) as UTCTimestamp;
        expect(result.finalSenkouA).toEqual([
            { time: expectedTime, value: 105 },
        ]);
        expect(result.finalSenkouB).toEqual([
            { time: expectedTime, value: 100 },
        ]);
        expect(result.finalCloudBullish).toEqual([
            { time: expectedTime, value: 105 },
        ]);
        expect(result.finalCloudBearish).toEqual([{ time: expectedTime }]);
    });

    it('preserves base data when extending', () => {
        const base: FutureCloudBase = {
            senkouAData: [{ time: 100 as UTCTimestamp, value: 50 }],
            senkouBData: [{ time: 100 as UTCTimestamp, value: 45 }],
            cloudBullishData: [{ time: 100 as UTCTimestamp, value: 50 }],
            cloudBearishData: [],
        };
        const futureCloud: IchimokuCloudPoint[] = [
            {
                tenkan: null,
                kijun: null,
                senkouA: 60,
                senkouB: 55,
                cloudBullishUpper: 60,
                cloudBearishUpper: null,
                chikou: null,
            },
        ];

        const result = extendWithFutureCloud(mockBars, futureCloud, base);

        expect(result.finalSenkouA).toHaveLength(2);
        expect(result.finalSenkouA[0]).toEqual({
            time: 100 as UTCTimestamp,
            value: 50,
        });
    });

    it('handles null senkouA in future cloud', () => {
        const futureCloud: IchimokuCloudPoint[] = [
            {
                tenkan: null,
                kijun: null,
                senkouA: null,
                senkouB: 100,
                cloudBullishUpper: null,
                cloudBearishUpper: null,
                chikou: null,
            },
        ];

        const result = extendWithFutureCloud(mockBars, futureCloud, emptyBase);

        expect(result.finalSenkouA[0]).toEqual({
            time: (300 + 100) as UTCTimestamp,
        });
        expect(result.finalSenkouB[0]).toEqual({
            time: (300 + 100) as UTCTimestamp,
            value: 100,
        });
    });

    it('uses correct interval between multiple future points', () => {
        const futureCloud: IchimokuCloudPoint[] = [
            {
                tenkan: null,
                kijun: null,
                senkouA: 105,
                senkouB: 100,
                cloudBullishUpper: 105,
                cloudBearishUpper: null,
                chikou: null,
            },
            {
                tenkan: null,
                kijun: null,
                senkouA: 110,
                senkouB: 102,
                cloudBullishUpper: 110,
                cloudBearishUpper: null,
                chikou: null,
            },
        ];

        const result = extendWithFutureCloud(mockBars, futureCloud, emptyBase);

        const interval = mockBars[2].time - mockBars[1].time;
        expect(result.finalSenkouA[0].time).toBe(
            mockBars[2].time + 1 * interval
        );
        expect(result.finalSenkouA[1].time).toBe(
            mockBars[2].time + 2 * interval
        );
    });

    it('returns base data when futureCloud is empty', () => {
        const base: FutureCloudBase = {
            senkouAData: [{ time: 100 as UTCTimestamp, value: 50 }],
            senkouBData: [{ time: 100 as UTCTimestamp, value: 45 }],
            cloudBullishData: [],
            cloudBearishData: [],
        };

        const result = extendWithFutureCloud(mockBars, [], base);

        expect(result.finalSenkouA).toEqual(base.senkouAData);
        expect(result.finalSenkouB).toEqual(base.senkouBData);
    });
});
