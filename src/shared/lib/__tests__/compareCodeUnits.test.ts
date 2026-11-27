import { describe, expect, it } from 'vitest';
import { compareCodeUnits } from '@/shared/lib/compareCodeUnits';

describe('compareCodeUnits', () => {
    it.each([
        ['a', 'b', -1],
        ['b', 'a', 1],
        ['a', 'a', 0],
        ['Z', 'a', -1],
        ['', 'a', -1],
    ])('%s vs %s -> %i', (a, b, expected) => {
        expect(compareCodeUnits(a, b)).toBe(expected);
    });

    it('sorts by code unit, not by locale', () => {
        expect(['b', 'B', 'a', 'A'].toSorted(compareCodeUnits)).toEqual([
            'A',
            'B',
            'a',
            'b',
        ]);
    });
});
