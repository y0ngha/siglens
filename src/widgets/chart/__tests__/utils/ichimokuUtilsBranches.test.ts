/**
 * Branch coverage for ichimokuUtils — targets uncovered:
 * - L52: cloudBullishUpper null → { time } (no value)
 * - L64: cloudBearishUpper null → { time } (no value)
 */

import type { Bar } from '@y0ngha/siglens-core';
import {
    buildCloudData,
    extendWithFutureCloud,
    type FutureCloudBase,
} from '@/widgets/chart/utils/ichimokuUtils';

const mockBars: Bar[] = [
    { time: 100, open: 10, high: 15, low: 9, close: 12, volume: 1000 },
    { time: 200, open: 12, high: 18, low: 11, close: 15, volume: 1200 },
];

const emptyBase: FutureCloudBase = {
    senkouAData: [],
    senkouBData: [],
    cloudBullishData: [],
    cloudBearishData: [],
};

describe('ichimokuUtils — null cloud branches in extendWithFutureCloud', () => {
    it('handles bearish future cloud point (cloudBullishUpper is null)', () => {
        // senkouA < senkouB → cloudBullishUpper = null, cloudBearishUpper = senkouB
        const futureCloud = buildCloudData([{ senkouA: 90, senkouB: 100 }]);

        // Verify the input data
        expect(futureCloud[0].cloudBullishUpper).toBeNull();
        expect(futureCloud[0].cloudBearishUpper).toBe(100);

        const result = extendWithFutureCloud(mockBars, futureCloud, emptyBase);

        // The cloudBullish series should have a point without value (just time)
        expect(result.finalCloudBullish).toHaveLength(1);
        expect(result.finalCloudBullish[0]).not.toHaveProperty('value');

        // The cloudBearish series should have a point with value
        expect(result.finalCloudBearish).toHaveLength(1);
        expect(result.finalCloudBearish[0]).toHaveProperty('value', 100);
    });

    it('handles bullish future cloud point (cloudBearishUpper is null)', () => {
        // senkouA >= senkouB → cloudBullishUpper = senkouA, cloudBearishUpper = null
        const futureCloud = buildCloudData([{ senkouA: 110, senkouB: 100 }]);

        expect(futureCloud[0].cloudBullishUpper).toBe(110);
        expect(futureCloud[0].cloudBearishUpper).toBeNull();

        const result = extendWithFutureCloud(mockBars, futureCloud, emptyBase);

        // cloudBullish should have value
        expect(result.finalCloudBullish).toHaveLength(1);
        expect(result.finalCloudBullish[0]).toHaveProperty('value', 110);

        // cloudBearish should NOT have value (just time)
        expect(result.finalCloudBearish).toHaveLength(1);
        expect(result.finalCloudBearish[0]).not.toHaveProperty('value');
    });
});
