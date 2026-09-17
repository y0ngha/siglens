import { toEnrichedMarketNewsItem } from '../toEnrichedMarketNewsItem';
import type { MarketNewsRow } from '../../model';

const baseRow: MarketNewsRow = {
    id: 'm1',
    symbol: '__NEWS_CRYPTO__',
    source: 'CoinWire',
    url: 'https://x/btc',
    publishedAt: '2026-06-15T10:00:00.000Z',
    titleEn: 'BTC ETF inflows',
    bodyEn: null,
    titleKo: 'BTC ETF 유입',
    bodyKo: '본문',
    summaryKo: '유입',
    sentiment: 'bullish',
    category: 'macro',
    priceImpact: 'high',
    tickers: ['BTCUSD'],
    analyzedAt: new Date('2026-06-15T10:30:00.000Z'),
};

describe('toEnrichedMarketNewsItem 매퍼는', () => {
    it('분석 완료된 row를 core EnrichedNewsItem 형상으로 매핑한다', () => {
        const item = toEnrichedMarketNewsItem(baseRow);

        expect(item).toEqual({
            id: 'm1',
            symbol: '__NEWS_CRYPTO__',
            source: 'CoinWire',
            url: 'https://x/btc',
            publishedAt: '2026-06-15T10:00:00.000Z',
            titleEn: 'BTC ETF inflows',
            bodyEn: null,
            card: {
                titleKo: 'BTC ETF 유입',
                bodyKo: '본문',
                summaryKo: '유입',
                sentiment: 'bullish',
                category: 'macro',
                priceImpact: 'high',
            },
        });
    });

    it('bodyKo가 null이어도 card.bodyKo로 그대로 전달한다', () => {
        const item = toEnrichedMarketNewsItem({ ...baseRow, bodyKo: null });

        expect(item?.card.bodyKo).toBeNull();
    });

    it.each([
        ['titleKo', { titleKo: null }],
        ['summaryKo', { summaryKo: null }],
        ['sentiment', { sentiment: null }],
        ['category', { category: null }],
        ['priceImpact', { priceImpact: null }],
    ] as const)('%s가 null이면(미분석) null을 반환한다', (_field, override) => {
        const result = toEnrichedMarketNewsItem({
            ...baseRow,
            ...override,
        });

        expect(result).toBeNull();
    });
});
