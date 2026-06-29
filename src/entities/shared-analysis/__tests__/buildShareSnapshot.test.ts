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
});
