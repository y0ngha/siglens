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
        expect(result.has(16)).toBe(true);
    });
});
