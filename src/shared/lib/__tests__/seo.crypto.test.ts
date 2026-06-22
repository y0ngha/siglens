import { describe, it, expect } from 'vitest';
import { buildCryptoSymbolSeoContent, resolveSymbolSeoContent } from '../seo';

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

describe('resolveSymbolSeoContent', () => {
    it('crypto branch — delegates to buildCryptoSymbolSeoContent (시세-framed title, no 주가 keyword)', () => {
        const c = resolveSymbolSeoContent('BTCUSD', 'crypto', {
            displayName: 'Bitcoin USD',
        });
        // buildCryptoSymbolSeoContent produces "Bitcoin USD(BTCUSD) 시세 분석 — 차트와 매매 신호"
        expect(c.title).toContain('시세 분석');
        expect(c.title).not.toContain('주가');
        // crypto keywords use 시세/가격, not 주가/주가 전망
        expect(c.keywords).toContain('BTCUSD 시세');
        expect(c.keywords).not.toContain('BTCUSD 주가');
        expect(c.url).toBe('https://siglens.io/BTCUSD');
    });

    it('stock branch — delegates to buildSymbolSeoContent (주가-framed title, no 시세 keyword)', () => {
        const c = resolveSymbolSeoContent('AAPL', 'equity', {
            displayName: 'Apple Inc.',
            koreanName: '애플',
        });
        // buildSymbolSeoContent produces "AAPL 주가 분석 — 차트와 매매 신호, 지지선·저항선"
        expect(c.title).toBe(
            'AAPL 주가 분석 — 차트와 매매 신호, 지지선·저항선'
        );
        // stock keywords use 주가, not 시세
        expect(c.keywords).toContain('AAPL 주가');
        expect(c.keywords).toContain('애플 주가');
        expect(c.keywords).not.toContain('AAPL 시세');
        expect(c.url).toBe('https://siglens.io/AAPL');
    });
});
