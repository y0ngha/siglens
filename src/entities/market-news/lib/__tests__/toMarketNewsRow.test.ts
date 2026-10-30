import { toMarketNewsRow, type MarketNewsDbRow } from '../toMarketNewsRow';

const DB_ROW: MarketNewsDbRow = {
    id: 'm1',
    symbol: '__NEWS_CRYPTO__',
    source: 'CoinWire',
    url: 'https://x.com/btc',
    publishedAt: new Date('2026-06-15T10:00:00.000Z'),
    titleEn: 'BTC up',
    titleKo: 'BTC 상승',
    bodyKo: null,
    summaryKo: '요약',
    sentiment: 'bullish',
    category: 'macro',
    priceImpact: 'high',
    tickers: ['BTCUSD'],
    analyzedAt: new Date('2026-06-15T11:00:00.000Z'),
};

describe('toMarketNewsRow는', () => {
    it('발행 시각을 ISO 문자열로 바꾸고 본문 영문은 항상 null이다', () => {
        const row = toMarketNewsRow({ ...DB_ROW, bodyEn: 'ignored' });

        expect(row.publishedAt).toBe('2026-06-15T10:00:00.000Z');
        expect(row.bodyEn).toBeNull();
    });

    it('버킷·티커·분석 시각을 그대로 싣는다', () => {
        const row = toMarketNewsRow(DB_ROW);

        expect(row.symbol).toBe('__NEWS_CRYPTO__');
        expect(row.tickers).toEqual(['BTCUSD']);
        expect(row.analyzedAt).toEqual(new Date('2026-06-15T11:00:00.000Z'));
    });

    it('알 수 없는 enum 문자열은 null로 떨어뜨린다', () => {
        const row = toMarketNewsRow({
            ...DB_ROW,
            sentiment: 'sideways',
            category: 'bogus',
            priceImpact: 'huge',
        });

        expect(row.sentiment).toBeNull();
        expect(row.category).toBeNull();
        expect(row.priceImpact).toBeNull();
    });
});
