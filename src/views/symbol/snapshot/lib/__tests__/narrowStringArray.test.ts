import { describe, it, expect } from 'vitest';
import { narrowStringArray } from '../narrowStringArray';

describe('narrowStringArray', () => {
    it('returns an empty array for an empty array', () => {
        expect(narrowStringArray([])).toEqual([]);
    });

    it('returns an empty array for non-array input', () => {
        expect(narrowStringArray(null)).toEqual([]);
        expect(narrowStringArray(undefined)).toEqual([]);
        expect(narrowStringArray('not an array')).toEqual([]);
        expect(narrowStringArray(42)).toEqual([]);
        expect(narrowStringArray({ length: 1, 0: 'x' })).toEqual([]);
    });

    it('drops non-string items from a mixed-type array', () => {
        expect(
            narrowStringArray([
                '첫 번째 항목',
                42,
                null,
                undefined,
                { foo: 'bar' },
                '두 번째 항목',
            ])
        ).toEqual(['첫 번째 항목', '두 번째 항목']);
    });

    it('strips markdown markers from each item', () => {
        expect(narrowStringArray(['**강조된** 항목', '- 목록 항목'])).toEqual([
            '강조된 항목',
            '목록 항목',
        ]);
    });

    it('trims and drops whitespace-only entries after stripping', () => {
        expect(
            narrowStringArray([
                '  앞뒤 공백  ',
                '   ',
                '',
                '\n\t',
                '유효한 항목',
            ])
        ).toEqual(['앞뒤 공백', '유효한 항목']);
    });
});
