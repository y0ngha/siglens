import { describe, expect, it } from 'vitest';
import { buildBarsRawKey, buildQuoteSnapshotKey } from '../marketCacheKeys';

describe('buildQuoteSnapshotKey', () => {
    it('upper-cases the symbol under the quote:snapshot prefix', () => {
        expect(buildQuoteSnapshotKey('aapl')).toBe('quote:snapshot:AAPL');
    });
});

describe('buildBarsRawKey', () => {
    it('includes every option that can change the result', () => {
        expect(
            buildBarsRawKey({
                symbol: 'aapl',
                timeframe: '1Day',
                from: '2026-01-02',
                before: '2026-03-01',
                limit: 300,
            })
        ).toBe('bars:raw:AAPL:1Day:2026-01-02:2026-03-01:300');
    });

    it('leaves omitted options empty', () => {
        expect(buildBarsRawKey({ symbol: 'MSFT', timeframe: '1Hour' })).toBe(
            'bars:raw:MSFT:1Hour:::'
        );
    });
});
