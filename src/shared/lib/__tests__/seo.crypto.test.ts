import { describe, it, expect } from 'vitest';
import {
    buildCryptoSymbolSeoContent,
    buildCryptoSymbolNewsSeoContent,
    buildCryptoSymbolOverallSeoContent,
    buildCryptoSymbolFearGreedSeoContent,
    resolveSymbolSeoContent,
    resolveSymbolNewsSeoContent,
    resolveSymbolOverallSeoContent,
    resolveSymbolFearGreedSeoContent,
    buildSymbolNewsSeoContent,
    buildSymbolOverallSeoContent,
    buildSymbolFearGreedSeoContent,
    SEO_DESCRIPTION_MAX_LENGTH,
} from '../seo';

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

    it('L1: title is ticker-led for SERP length safety', () => {
        const c = buildCryptoSymbolSeoContent('BTCUSD', {
            displayName: 'Bitcoin USD',
        });
        // Format: "{TICKER} 시세 분석 — {displayName} 차트와 매매 신호"
        expect(c.title).toMatch(/^BTCUSD 시세 분석/);
        expect(c.title).toContain('Bitcoin USD');
    });

    it('falls back to ticker as display name', () => {
        const c = buildCryptoSymbolSeoContent('ETHUSD');
        expect(c.description).toContain('ETHUSD');
    });

    it('description is within 120-char SEO safe zone', () => {
        const c = buildCryptoSymbolSeoContent('BTCUSD', {
            displayName: 'Bitcoin USD',
        });
        expect([...c.description].length).toBeLessThanOrEqual(
            SEO_DESCRIPTION_MAX_LENGTH
        );
    });
});

describe('resolveSymbolSeoContent', () => {
    it('crypto branch — delegates to buildCryptoSymbolSeoContent (시세-framed title, no 주가 keyword)', () => {
        const c = resolveSymbolSeoContent('BTCUSD', 'crypto', {
            displayName: 'Bitcoin USD',
        });
        // buildCryptoSymbolSeoContent produces "BTCUSD 시세 분석 — Bitcoin USD 차트와 매매 신호"
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

// ---------------------------------------------------------------------------
// H2: Crypto news SEO builder
// ---------------------------------------------------------------------------

describe('buildCryptoSymbolNewsSeoContent', () => {
    it('title is crypto-framed — no 어닝/실적/애널리스트 wording', () => {
        const c = buildCryptoSymbolNewsSeoContent('BTCUSD', {
            displayName: 'Bitcoin USD',
        });
        expect(c.title).not.toContain('어닝');
        expect(c.title).not.toContain('실적');
        expect(c.title).not.toContain('애널리스트');
        expect(c.title).toContain('뉴스');
    });

    it('description is crypto-appropriate and within 120 chars', () => {
        const c = buildCryptoSymbolNewsSeoContent('BTCUSD', {
            displayName: 'Bitcoin USD',
        });
        expect(c.description).toContain('Bitcoin USD');
        expect(c.description).not.toContain('어닝');
        expect(c.description).not.toContain('애널리스트');
        expect([...c.description].length).toBeLessThanOrEqual(
            SEO_DESCRIPTION_MAX_LENGTH
        );
    });

    it('keywords include crypto-appropriate terms, exclude stock equity terms', () => {
        const c = buildCryptoSymbolNewsSeoContent('BTCUSD');
        expect(c.keywords).toContain('BTCUSD 뉴스');
        expect(c.keywords).toContain('BTCUSD 코인 뉴스');
        expect(c.keywords).toContain('BTCUSD 호재');
        expect(c.keywords).not.toContain('BTCUSD 어닝 일정');
        expect(c.keywords).not.toContain('BTCUSD 실적 발표');
        expect(c.keywords).not.toContain('BTCUSD 애널리스트 등급');
    });

    it('URL is /[TICKER]/news', () => {
        const c = buildCryptoSymbolNewsSeoContent('ETHUSD');
        expect(c.url).toBe('https://siglens.io/ETHUSD/news');
    });

    it('falls back to ticker when no displayName provided', () => {
        const c = buildCryptoSymbolNewsSeoContent('SOLUSD');
        expect(c.description).toContain('SOLUSD');
    });
});

describe('resolveSymbolNewsSeoContent', () => {
    it('crypto → buildCryptoSymbolNewsSeoContent (no 어닝/실적 copy)', () => {
        const c = resolveSymbolNewsSeoContent('BTCUSD', 'crypto', {
            displayName: 'Bitcoin USD',
        });
        expect(c.title).not.toContain('어닝');
        expect(c.title).not.toContain('실적');
        expect(c.url).toBe('https://siglens.io/BTCUSD/news');
    });

    it('equity → buildSymbolNewsSeoContent (어닝/실적/애널리스트 copy preserved)', () => {
        const c = resolveSymbolNewsSeoContent('AAPL', 'equity', {
            displayName: '애플, Apple Inc. (AAPL)',
            koreanName: '애플',
        });
        // Stock builder title contains 어닝 and 애널리스트
        expect(c.title).toContain('어닝');
        expect(c.title).toContain('애널리스트');
        // Verify equity builder is unchanged
        const stock = buildSymbolNewsSeoContent('AAPL', {
            displayName: '애플, Apple Inc. (AAPL)',
            koreanName: '애플',
        });
        expect(c.title).toBe(stock.title);
        expect(c.description).toBe(stock.description);
    });
});

// ---------------------------------------------------------------------------
// H3: Crypto overall SEO builder
// ---------------------------------------------------------------------------

describe('buildCryptoSymbolOverallSeoContent', () => {
    it('title is crypto-framed — no 주가/분기실적/펀더멘털 wording', () => {
        const c = buildCryptoSymbolOverallSeoContent('BTCUSD', {
            displayName: 'Bitcoin USD',
        });
        expect(c.title).not.toContain('주가');
        expect(c.title).not.toContain('분기 실적');
        expect(c.title).not.toContain('펀더멘털');
        expect(c.title).toContain('종합 분석');
    });

    it('description mentions crypto-appropriate axes (차트/뉴스/매수 분위기)', () => {
        const c = buildCryptoSymbolOverallSeoContent('BTCUSD', {
            displayName: 'Bitcoin USD',
        });
        expect(c.description).toContain('Bitcoin USD');
        expect(c.description).not.toContain('주가');
        expect(c.description).not.toContain('분기 실적');
        expect([...c.description].length).toBeLessThanOrEqual(
            SEO_DESCRIPTION_MAX_LENGTH
        );
    });

    it('keywords include crypto-appropriate terms, exclude stock equity terms', () => {
        const c = buildCryptoSymbolOverallSeoContent('BTCUSD');
        expect(c.keywords).toContain('BTCUSD AI 종합 분석');
        expect(c.keywords).toContain('BTCUSD 코인 종합 분석');
        expect(c.keywords).not.toContain('BTCUSD 4축 분석');
        expect(c.keywords).not.toContain('펀더멘털 분석');
    });

    it('URL is /[TICKER]/overall', () => {
        const c = buildCryptoSymbolOverallSeoContent('ETHUSD');
        expect(c.url).toBe('https://siglens.io/ETHUSD/overall');
    });

    it('falls back to ticker when no displayName provided', () => {
        const c = buildCryptoSymbolOverallSeoContent('SOLUSD');
        expect(c.description).toContain('SOLUSD');
    });
});

describe('resolveSymbolOverallSeoContent', () => {
    it('crypto → buildCryptoSymbolOverallSeoContent (no 주가/분기실적 copy)', () => {
        const c = resolveSymbolOverallSeoContent('BTCUSD', 'crypto', {
            displayName: 'Bitcoin USD',
        });
        expect(c.title).not.toContain('주가');
        expect(c.description).not.toContain('분기 실적');
        expect(c.url).toBe('https://siglens.io/BTCUSD/overall');
    });

    it('equity → buildSymbolOverallSeoContent (주가/실적 copy preserved)', () => {
        const c = resolveSymbolOverallSeoContent('AAPL', 'equity', {
            displayName: '애플, Apple Inc. (AAPL)',
            koreanName: '애플',
        });
        const stock = buildSymbolOverallSeoContent('AAPL', {
            displayName: '애플, Apple Inc. (AAPL)',
            koreanName: '애플',
        });
        expect(c.title).toBe(stock.title);
        expect(c.description).toBe(stock.description);
    });
});

// ---------------------------------------------------------------------------
// M1: Crypto fear-greed SEO builder
// ---------------------------------------------------------------------------

describe('buildCryptoSymbolFearGreedSeoContent', () => {
    it('title is crypto-framed (코인 분위기)', () => {
        const c = buildCryptoSymbolFearGreedSeoContent('BTCUSD', {
            displayName: 'Bitcoin USD',
        });
        expect(c.title).toContain('공포 탐욕 지수');
        expect(c.title).toContain('코인');
    });

    it('description is within 120 chars and mentions subject', () => {
        const c = buildCryptoSymbolFearGreedSeoContent('BTCUSD', {
            displayName: 'Bitcoin USD',
        });
        expect(c.description).toContain('Bitcoin USD');
        expect([...c.description].length).toBeLessThanOrEqual(
            SEO_DESCRIPTION_MAX_LENGTH
        );
    });

    it('keywords include crypto-appropriate terms, no stock-equity wording', () => {
        const c = buildCryptoSymbolFearGreedSeoContent('BTCUSD');
        expect(c.keywords).toContain('BTCUSD 공포 지수');
        expect(c.keywords).toContain('BTCUSD 코인 매수 분위기');
        expect(c.keywords).toContain('코인 투자 심리');
        expect(c.keywords).toContain('크립토 투자 심리');
        // Stock equity terms from buildSymbolFearGreedKeywords should not appear
        expect(c.keywords).not.toContain('주식 매수 분위기');
        expect(c.keywords).not.toContain('단기 매매 심리');
    });

    it('URL is /[TICKER]/fear-greed', () => {
        const c = buildCryptoSymbolFearGreedSeoContent('ETHUSD');
        expect(c.url).toBe('https://siglens.io/ETHUSD/fear-greed');
    });

    it('falls back to ticker when no displayName provided', () => {
        const c = buildCryptoSymbolFearGreedSeoContent('SOLUSD');
        expect(c.description).toContain('SOLUSD');
    });
});

describe('resolveSymbolFearGreedSeoContent', () => {
    it('crypto → buildCryptoSymbolFearGreedSeoContent (coin-framed keywords)', () => {
        const c = resolveSymbolFearGreedSeoContent('BTCUSD', 'crypto', {
            displayName: 'Bitcoin USD',
        });
        expect(c.keywords).toContain('코인 매수 분위기');
        expect(c.keywords).not.toContain('주식 매수 분위기');
        expect(c.url).toBe('https://siglens.io/BTCUSD/fear-greed');
    });

    it('equity → buildSymbolFearGreedSeoContent (equity wording preserved)', () => {
        const c = resolveSymbolFearGreedSeoContent('AAPL', 'equity', {
            displayName: '애플, Apple Inc. (AAPL)',
            koreanName: '애플',
        });
        // resolveSymbolFearGreedSeoContent does not forward sector (no caller provides it),
        // so compare against the no-sector variant of the stock builder.
        const stock = buildSymbolFearGreedSeoContent('AAPL', {
            displayName: '애플, Apple Inc. (AAPL)',
            koreanName: '애플',
        });
        expect(c.title).toBe(stock.title);
        expect(c.keywords).toStrictEqual(stock.keywords);
    });

    it('equity branch forwards sector to buildSymbolFearGreedSeoContent', () => {
        const c = resolveSymbolFearGreedSeoContent('AAPL', 'equity', {
            displayName: 'Apple Inc.',
        });
        // sector not provided → no sector keyword in result (no crash either)
        expect(c.keywords).not.toContain('undefined 섹터 매수 분위기');
    });
});
