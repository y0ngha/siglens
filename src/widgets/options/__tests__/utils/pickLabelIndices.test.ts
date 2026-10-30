import { pickLabelIndices } from '@/widgets/options/utils/pickLabelIndices';

describe('pickLabelIndices', () => {
    it('returns all indices when count <= maxLabels', () => {
        const result = pickLabelIndices(5, [], 10);
        expect(result).toEqual(new Set([0, 1, 2, 3, 4]));
    });

    it('returns all indices when count equals maxLabels', () => {
        const result = pickLabelIndices(10, [], 10);
        expect(result).toEqual(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
    });

    it('always includes the last index', () => {
        const result = pickLabelIndices(20, [], 5);
        expect(result.has(19)).toBe(true);
    });

    it('always includes valid anchor indices', () => {
        const result = pickLabelIndices(30, [7, 15], 5);
        expect(result.has(7)).toBe(true);
        expect(result.has(15)).toBe(true);
    });

    it('skips invalid anchor indices (negative or out of range)', () => {
        const result = pickLabelIndices(10, [-1, 50], 5);
        expect(result.has(-1)).toBe(false);
        expect(result.has(50)).toBe(false);
    });

    it('limits output size near maxLabels for large counts', () => {
        const result = pickLabelIndices(100, [], 10);
        expect(result.size).toBeLessThanOrEqual(15);
    });

    it('always includes index 0 via stride', () => {
        const result = pickLabelIndices(50, [], 10);
        expect(result.has(0)).toBe(true);
    });

    it('uses even stride spacing', () => {
        const result = pickLabelIndices(20, [], 5);
        expect(result.has(0)).toBe(true);
        expect(result.has(4)).toBe(true);
        expect(result.has(8)).toBe(true);
        expect(result.has(12)).toBe(true);
    });

    describe('anchor spacing', () => {
        it('drops the stride index adjacent to the last index (count=12, max=10)', () => {
            const result = pickLabelIndices(12, [], 10);
            expect(result).toEqual(new Set([0, 2, 4, 6, 8, 11]));
        });

        it('drops stride indices closer than one stride to a mid-chart anchor', () => {
            // stride 4: 8 (dist 1), 12 (dist 3) and 16 (dist 3 from 19) are dropped.
            const result = pickLabelIndices(20, [9], 5);
            expect(result).toEqual(new Set([0, 4, 9, 19]));
        });

        it('keeps adjacent anchors even though they are closer than one stride', () => {
            const result = pickLabelIndices(30, [14, 15], 5);
            expect(result.has(14)).toBe(true);
            expect(result.has(15)).toBe(true);
        });

        it('keeps a stride index exactly one stride away from an anchor', () => {
            const result = pickLabelIndices(20, [8], 5);
            expect(result.has(4)).toBe(true);
            expect(result.has(12)).toBe(true);
        });
    });
});
