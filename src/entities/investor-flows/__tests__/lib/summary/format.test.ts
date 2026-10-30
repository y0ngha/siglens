import {
    clipSummaryText,
    latestBy,
    pctChange,
    round,
} from '../../../lib/summary/format';

describe('round', () => {
    it('rounds to the requested digits', () => {
        expect(round(1.23456, 4)).toBe(1.2346);
    });

    it('rounds to an integer with zero digits', () => {
        expect(round(2.5, 0)).toBe(3);
    });
});

describe('pctChange', () => {
    it('rounds the change to one decimal', () => {
        expect(pctChange(110, 100)).toBe(10);
    });

    it('is null without a previous value', () => {
        expect(pctChange(5, null)).toBeNull();
    });

    it('is null when the previous value is zero', () => {
        expect(pctChange(5, 0)).toBeNull();
    });
});

describe('clipSummaryText', () => {
    it('flattens whitespace and newlines', () => {
        expect(clipSummaryText('  A\n\nB   C ', 20)).toBe('A B C');
    });

    it('truncates with an ellipsis at max characters', () => {
        expect(clipSummaryText('abcdefghij', 5)).toBe('abcd…');
    });

    it('keeps text that fits exactly', () => {
        expect(clipSummaryText('abcde', 5)).toBe('abcde');
    });
});

describe('latestBy', () => {
    it('returns null for no rows', () => {
        expect(latestBy([], (r: { d: string }) => r.d)).toBeNull();
    });

    it('returns the newest row', () => {
        const rows = [
            { d: '2026-01-02' },
            { d: '2026-03-01' },
            { d: '2026-02-01' },
        ];
        expect(latestBy(rows, r => r.d)).toEqual({ d: '2026-03-01' });
    });

    it('picks the later input row on equal keys', () => {
        const rows = [
            { d: '2026-01-02', id: 'a' },
            { d: '2026-01-02', id: 'b' },
        ];
        expect(latestBy(rows, r => r.d)?.id).toBe('b');
    });
});
