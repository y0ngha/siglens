import { describe, it, expect } from 'vitest';
import { getDescriptor } from '../registry';

describe('us-equity market profile descriptor', () => {
    const d = getDescriptor('us-equity');

    it('passes the canonical symbol straight through to FMP (no mapping needed)', () => {
        expect(d.toProviderSymbol('AAPL')).toBe('AAPL');
        expect(d.toProviderSymbol('BRK.B')).toBe('BRK.B');
    });

    it('formats prices as USD with 2 decimals', () => {
        expect(d.priceFormat.currency).toBe('USD');
        expect(d.priceFormat.precision).toEqual({ kind: 'fixed', digits: 2 });
    });

    it('has zero quote delay (FMP US feed is realtime)', () => {
        expect(d.quoteDelayMinutes).toBe(0);
    });

    it('routes to fmp data + stock news/search sources', () => {
        expect(d.dataProvider).toBe('fmp');
        expect(d.newsSource).toBe('stock');
        expect(d.searchSource).toBe('fmp-us');
    });

    it('includes options, congress, and financials tabs (US-only coverage)', () => {
        expect(d.tabs).toContain('options');
        expect(d.tabs).toContain('congress');
        expect(d.tabs).toContain('financials');
    });

    it('supports the full intraday timeframe set including 4Hour', () => {
        expect(d.allowedTimeframes).toEqual([
            '5Min',
            '15Min',
            '30Min',
            '1Hour',
            '4Hour',
            '1Day',
        ]);
    });

    it('exposes a Corporation about-node type for SEO', () => {
        expect(d.seo.aboutNodeType).toBe('Corporation');
    });
});
