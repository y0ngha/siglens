import { buildOpenInterestChartModel } from '@/widgets/options/utils/openInterestChartModel';
import type { StrikeOpenInterest } from '@y0ngha/siglens-core';

const oi = (
    strike: number,
    callOpenInterest: number,
    putOpenInterest: number
): StrikeOpenInterest => ({ strike, callOpenInterest, putOpenInterest });

const ROWS: StrikeOpenInterest[] = [
    oi(100, 10, 5),
    oi(110, 50, 40),
    oi(120, 200, 100),
    oi(130, 30, 20),
    oi(140, 5, 5),
];

describe('buildOpenInterestChartModel', () => {
    describe('when there is nothing to draw', () => {
        it('returns null for an empty aggregate', () => {
            expect(buildOpenInterestChartModel([], 120, 120)).toBeNull();
        });

        it('returns null when every strike has zero OI on both sides', () => {
            expect(
                buildOpenInterestChartModel(
                    [oi(100, 0, 0), oi(110, 0, 0)],
                    null,
                    105
                )
            ).toBeNull();
        });
    });

    describe('when there is OI', () => {
        it('keeps the rows as given', () => {
            expect(buildOpenInterestChartModel(ROWS, 120, 120)?.rows).toBe(
                ROWS
            );
        });

        it('marks the three strikes with the largest combined OI', () => {
            const model = buildOpenInterestChartModel(ROWS, 120, 120)!;
            expect(model.topOiStrikes).toEqual(new Set([120, 110, 130]));
        });

        it('uses the largest single side as globalMax', () => {
            expect(buildOpenInterestChartModel(ROWS, 120, 120)?.globalMax).toBe(
                200
            );
        });

        it('floors globalMax at 1 so a lone sub-1 value never scales to zero', () => {
            const model = buildOpenInterestChartModel(
                [oi(100, 0.2, 0)],
                null,
                100
            )!;
            expect(model.globalMax).toBe(1);
        });

        it('locates the strikes nearest Max Pain and the spot price', () => {
            const model = buildOpenInterestChartModel(ROWS, 112, 133)!;
            expect(model.maxPainIdx).toBe(1);
            expect(model.currentPriceIdx).toBe(3);
        });

        it('uses -1 for maxPainIdx when Max Pain is null', () => {
            expect(
                buildOpenInterestChartModel(ROWS, null, 120)?.maxPainIdx
            ).toBe(-1);
        });

        it('labels every strike when few are listed', () => {
            expect(
                buildOpenInterestChartModel(ROWS, 120, 120)?.labelIndices
            ).toEqual(new Set([0, 1, 2, 3, 4]));
        });

        it('thins labels for long chains and keeps the Max Pain and price anchors', () => {
            const many = Array.from({ length: 40 }, (_, i) =>
                oi(100 + i, 10 + i, 5)
            );
            const model = buildOpenInterestChartModel(many, 107, 125)!;
            expect(model.labelIndices.size).toBeLessThan(40);
            expect(model.labelIndices.has(model.maxPainIdx)).toBe(true);
            expect(model.labelIndices.has(model.currentPriceIdx)).toBe(true);
        });
    });
});
