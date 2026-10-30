import {
    ascendingTail,
    finiteNumber,
    isIsoDate,
    nonNegative,
} from '../../../lib/snapshot/snapshotRows';

describe('finiteNumber', () => {
    it('passes finite numbers through', () => {
        expect(finiteNumber(12.5)).toBe(12.5);
    });

    it('parses numeric strings', () => {
        expect(finiteNumber('42')).toBe(42);
    });

    it.each([NaN, Infinity, '', '   ', 'abc', null, undefined, {}])(
        'returns null for %s',
        value => {
            expect(finiteNumber(value)).toBeNull();
        }
    );
});

describe('nonNegative', () => {
    it('keeps zero', () => {
        expect(nonNegative(0)).toBe(0);
    });

    it('drops negatives', () => {
        expect(nonNegative(-1)).toBeNull();
    });

    it('drops non-numbers', () => {
        expect(nonNegative('x')).toBeNull();
    });
});

describe('isIsoDate', () => {
    it('accepts a date with a trailing time', () => {
        expect(isIsoDate('2026-10-05 12:00:00')).toBe(true);
    });

    it.each(['10/05/2026', '', null, 20261005])('rejects %s', value => {
        expect(isIsoDate(value)).toBe(false);
    });
});

describe('ascendingTail', () => {
    const rows = [{ d: '2026-03' }, { d: '2026-01' }, { d: '2026-02' }];

    it('keeps the newest rows, oldest first', () => {
        expect(ascendingTail(rows, row => row.d, 2)).toEqual([
            { d: '2026-02' },
            { d: '2026-03' },
        ]);
    });

    it('does not mutate the input', () => {
        ascendingTail(rows, row => row.d, 2);
        expect(rows.map(row => row.d)).toEqual([
            '2026-03',
            '2026-01',
            '2026-02',
        ]);
    });

    it('keeps input order for equal keys', () => {
        const tied = [
            { d: '2026-01', id: 'a' },
            { d: '2026-01', id: 'b' },
        ];
        expect(ascendingTail(tied, row => row.d, 2).map(r => r.id)).toEqual([
            'a',
            'b',
        ]);
    });
});
