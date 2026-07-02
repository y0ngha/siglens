import { parseSnapshot } from '@/entities/shared-analysis/lib/parseSnapshot';

const stubBar = {
    time: 1700000000,
    open: 150,
    high: 155,
    low: 148,
    close: 153,
    volume: 1000000,
};

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

    // ── chartBars pass-through ────────────────────────────────────────────────

    it('passes through chartBars when present (server-written trust boundary)', () => {
        const withBars = { ...valid, chartBars: [stubBar] };
        const snap = parseSnapshot(withBars);
        expect(snap).not.toBeNull();
        expect(snap?.chartBars).toEqual([stubBar]);
    });

    it('returns snapshot without chartBars when absent (old snapshots)', () => {
        const snap = parseSnapshot(valid);
        expect(snap).not.toBeNull();
        expect(snap?.chartBars).toBeUndefined();
    });
});
