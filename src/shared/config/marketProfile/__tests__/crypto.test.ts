import { describe, it, expect } from 'vitest';
import { getDescriptor } from '../registry';

describe('crypto market profile descriptor', () => {
    const d = getDescriptor('crypto');

    it('passes the canonical symbol straight through to FMP (already canonical)', () => {
        expect(d.toProviderSymbol('BTCUSD')).toBe('BTCUSD');
        expect(d.toProviderSymbol('ETHUSD')).toBe('ETHUSD');
    });

    it('is always open with zero quote delay (24/7 realtime)', () => {
        expect(d.sessionModel).toBe('always-open');
        expect(d.quoteDelayMinutes).toBe(0);
    });

    it('routes to fmp data + crypto news/search sources', () => {
        expect(d.dataProvider).toBe('fmp');
        expect(d.newsSource).toBe('crypto');
        expect(d.searchSource).toBe('crypto-store');
    });

    it('excludes intraday timeframes unsupported by FMP crypto endpoints', () => {
        expect(d.allowedTimeframes).toEqual(['5Min', '1Hour', '1Day']);
        expect(d.allowedTimeframes).not.toContain('15Min');
        expect(d.allowedTimeframes).not.toContain('4Hour');
    });

    it('includes the position tab (holdings are still meaningful for crypto)', () => {
        expect(d.tabs).toContain('position');
    });

    it('omits an about-node schema.org type', () => {
        expect(d.seo.aboutNodeType).toBeNull();
    });
});
