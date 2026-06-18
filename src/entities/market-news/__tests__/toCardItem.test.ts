import { describe, it, expect } from 'vitest';
import { toMarketNewsCardItem } from '../lib/toCardItem';
import type { MarketNewsRow } from '../model';

/** Fixture with all MarketNewsRow fields — including the three that must be excluded. */
const fullRow: MarketNewsRow = {
    id: 'row-1',
    publishedAt: '2026-06-15T10:00:00.000Z',
    titleEn: 'BTC ETF inflows surge',
    titleKo: 'BTC ETF 유입 급증',
    bodyEn: 'SENTINEL_BODY_EN', // must be excluded
    bodyKo: '본문 한국어',
    summaryKo: '요약',
    sentiment: 'bullish',
    category: 'macro',
    priceImpact: 'high',
    url: 'https://example.com/btc-etf',
    source: 'CoinWire',
    symbol: 'SENTINEL_SYMBOL', // must be excluded
    tickers: ['BTCUSD', 'ETHUSD'],
    analyzedAt: new Date('2026-06-15T11:00:00.000Z'), // must be excluded
};

describe('toMarketNewsCardItem', () => {
    it('MarketNewsRow를 MarketNewsCardItem으로 올바르게 매핑한다 (포함 필드 보존)', () => {
        const result = toMarketNewsCardItem(fullRow);

        expect(result.id).toBe('row-1');
        expect(result.publishedAt).toBe('2026-06-15T10:00:00.000Z');
        expect(result.titleEn).toBe('BTC ETF inflows surge');
        expect(result.titleKo).toBe('BTC ETF 유입 급증');
        expect(result.bodyKo).toBe('본문 한국어');
        expect(result.summaryKo).toBe('요약');
        expect(result.url).toBe('https://example.com/btc-etf');
        expect(result.source).toBe('CoinWire');
    });

    it('bodyEn, symbol, analyzedAt은 결과에 포함되지 않는다', () => {
        const result = toMarketNewsCardItem(fullRow);

        expect('bodyEn' in result).toBe(false);
        expect('symbol' in result).toBe(false);
        expect('analyzedAt' in result).toBe(false);
    });

    it('tickers 배열을 변형 없이 그대로 전달한다', () => {
        const result = toMarketNewsCardItem(fullRow);

        expect(result.tickers).toEqual(['BTCUSD', 'ETHUSD']);
    });

    it('enum 필드(sentiment/category/priceImpact)를 그대로 보존한다', () => {
        const result = toMarketNewsCardItem(fullRow);

        expect(result.sentiment).toBe('bullish');
        expect(result.category).toBe('macro');
        expect(result.priceImpact).toBe('high');
    });
});
