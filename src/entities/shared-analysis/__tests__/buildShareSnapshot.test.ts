import { buildShareSnapshot } from '@/entities/shared-analysis/lib/buildShareSnapshot';
import type { CreateShareInput } from '@/entities/shared-analysis/types';

const input = {
    kind: 'chart',
    symbol: 'aapl',
    context: {
        symbol: 'AAPL',
        displayName: 'Apple',
        assetClass: 'us_equity',
        analyzedAt: '2026-06-29T00:00:00Z',
    },
    result: { trend: 'bullish', summary: '요약' },
    sharerTier: 'free',
} as unknown as CreateShareInput;

const stubBar = {
    time: 1700000000,
    open: 150,
    high: 155,
    low: 148,
    close: 153,
    volume: 1000000,
};

describe('buildShareSnapshot', () => {
    it('builds a snapshot with uppercased symbol', () => {
        const snap = buildShareSnapshot(input);
        expect(snap.symbol).toBe('AAPL');
        expect(snap.kind).toBe('chart');
        expect(snap.result).toEqual({ trend: 'bullish', summary: '요약' });
    });
    it('produces a JSON-stable object (no Date/undefined/functions)', () => {
        const snap = buildShareSnapshot(input);
        expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
    });

    // chartBars forwarding
    it('includes chartBars in snapshot when provided', () => {
        const inputWithBars = {
            ...input,
            chartBars: [stubBar, { ...stubBar, time: 1700086400 }],
        } as unknown as CreateShareInput;
        const snap = buildShareSnapshot(inputWithBars);
        expect(snap.chartBars).toHaveLength(2);
        expect(snap.chartBars?.[0]).toEqual(stubBar);
    });

    it('omits chartBars from snapshot when not provided', () => {
        const snap = buildShareSnapshot(input);
        expect(snap.chartBars).toBeUndefined();
        expect(Object.prototype.hasOwnProperty.call(snap, 'chartBars')).toBe(
            false
        );
    });

    it('produces a JSON-stable snapshot with chartBars', () => {
        const inputWithBars = {
            ...input,
            chartBars: [stubBar],
        } as unknown as CreateShareInput;
        const snap = buildShareSnapshot(inputWithBars);
        expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
    });
});
