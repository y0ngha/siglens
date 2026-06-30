import { parseSnapshot } from '@/entities/shared-analysis/lib/parseSnapshot';

describe('parseSnapshot', () => {
    const valid = {
        kind: 'chart',
        symbol: 'AAPL',
        context: {
            symbol: 'AAPL',
            displayName: 'Apple',
            assetClass: 'us_equity',
        },
        result: { trend: 'bullish' },
    };
    it('returns the snapshot for a valid shape', () => {
        expect(parseSnapshot(valid)).toEqual(valid);
    });
    it('returns null when kind is missing', () => {
        expect(
            parseSnapshot({ symbol: 'AAPL', context: {}, result: {} })
        ).toBeNull();
    });
    it('returns null when kind is not a shareable kind', () => {
        expect(parseSnapshot({ ...valid, kind: 'bogus' })).toBeNull();
    });
    it('returns null for non-object input', () => {
        expect(parseSnapshot(null)).toBeNull();
        expect(parseSnapshot('x')).toBeNull();
    });

    // ── T5: additional rejection branches ────────────────────────────────────

    it('returns null when symbol is a number (not a string)', () => {
        expect(parseSnapshot({ ...valid, symbol: 123 })).toBeNull();
    });

    it('returns null when context is null', () => {
        expect(parseSnapshot({ ...valid, context: null })).toBeNull();
    });

    it('returns null when result is null', () => {
        expect(parseSnapshot({ ...valid, result: null })).toBeNull();
    });
});
