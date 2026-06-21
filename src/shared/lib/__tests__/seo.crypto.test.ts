import { describe, it, expect } from 'vitest';
import { buildCryptoSymbolSeoContent } from '../seo';

describe('buildCryptoSymbolSeoContent', () => {
    it('builds crypto-framed copy (no 주가/펀더멘털 wording)', () => {
        const c = buildCryptoSymbolSeoContent('BTCUSD', {
            displayName: 'Bitcoin USD',
        });
        expect(c.ticker).toBe('BTCUSD');
        expect(c.title).toContain('시세 분석');
        expect(c.title).not.toContain('주가');
        expect(c.description).toContain('Bitcoin USD');
        expect(c.url).toBe('https://siglens.io/BTCUSD');
        expect(c.keywords).toContain('BTCUSD 시세');
        expect(c.keywords).toContain('BTCUSD 차트 분석');
    });

    it('falls back to ticker as display name', () => {
        const c = buildCryptoSymbolSeoContent('ETHUSD');
        expect(c.description).toContain('ETHUSD');
    });
});
