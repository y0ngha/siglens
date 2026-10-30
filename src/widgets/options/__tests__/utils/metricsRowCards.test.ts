import { buildMetricCardValues } from '@/widgets/options/utils/metricsRowCards';
import type { OptionsExpirationMetrics } from '@y0ngha/siglens-core';

const METRICS: OptionsExpirationMetrics = {
    expirationDate: '2025-06-20',
    daysToExpiration: 30,
    maxPain: 150,
    maxPainDistancePct: null,
    putCallRatio: 0.8,
    atmImpliedVolatility: 0.35,
    impliedMovePercent: 4.2,
    impliedMoveRange: null,
    topOpenInterestStrikes: [],
    topVolumeStrikes: [],
    topOiBidAskSummary: [],
};

describe('buildMetricCardValues', () => {
    describe('when the OI snapshot is fresh', () => {
        it('formats every metric', () => {
            expect(buildMetricCardValues(METRICS, false)).toEqual({
                maxPain: '$150',
                putCallRatio: '0.80',
                atmIv: '35.0%',
                impliedMove: '±4.2%',
            });
        });

        it('falls back to the placeholder when metrics are absent', () => {
            expect(buildMetricCardValues(null, false)).toEqual({
                maxPain: '-',
                putCallRatio: '-',
                atmIv: '-',
                impliedMove: '-',
            });
        });
    });

    describe('when the OI snapshot is stale', () => {
        it('replaces every value with the placeholder', () => {
            expect(buildMetricCardValues(METRICS, true)).toEqual({
                maxPain: '-',
                putCallRatio: '-',
                atmIv: '-',
                impliedMove: '-',
            });
        });
    });
});
