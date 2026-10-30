import type { EnrichedNewsItem } from '@y0ngha/siglens-core';
import { selectAggregateNewsItems } from '@/entities/news-article/lib/newsAnalysisSelection';
import type { MarketNewsRow } from '../../model';
import { selectDigestNews, toCoreFeedCategory } from '../digestInput';

vi.mock('@/entities/news-article/lib/newsAnalysisSelection', () => ({
    selectAggregateNewsItems: vi.fn((items: EnrichedNewsItem[]) => items),
}));

function row(overrides: Partial<MarketNewsRow>): MarketNewsRow {
    return {
        id: 'm1',
        symbol: '__NEWS_CRYPTO__',
        source: 'CoinWire',
        url: 'https://x.com/btc',
        publishedAt: '2026-06-15T10:00:00.000Z',
        titleEn: 'BTC up',
        titleKo: 'BTC 상승',
        bodyKo: null,
        summaryKo: '요약',
        sentiment: 'bullish',
        category: 'macro',
        priceImpact: 'high',
        bodyEn: null,
        tickers: [],
        analyzedAt: new Date('2026-06-15T11:00:00.000Z'),
        ...overrides,
    };
}

describe('selectDigestNews는', () => {
    it('보강되지 않은 행을 빼고 나머지를 상위 기사 선별에 넘긴다', () => {
        const result = selectDigestNews([
            row({ id: 'done' }),
            row({
                id: 'pending',
                analyzedAt: null,
                titleKo: null,
                summaryKo: null,
                sentiment: null,
                category: null,
                priceImpact: null,
            }),
        ]);

        expect(result.map(item => item.id)).toEqual(['done']);
        expect(selectAggregateNewsItems).toHaveBeenCalledWith(result);
    });
});

describe('toCoreFeedCategory는', () => {
    it('siglens 전용 kr을 문자열 그대로 core에 넘긴다', () => {
        expect(toCoreFeedCategory('kr')).toBe('kr');
    });
});
