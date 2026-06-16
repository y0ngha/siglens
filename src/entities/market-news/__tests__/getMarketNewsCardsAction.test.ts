import { describe, it, expect, vi } from 'vitest';

// Mock database client
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {} })),
}));

// Mock the repository so we don't touch the real DB
const mockListByCategory = vi.fn(async () => [
    {
        id: 'm1',
        symbol: '__NEWS_CRYPTO__',
        source: 'CoinWire',
        url: 'https://x/btc',
        publishedAt: '2026-06-15T10:00:00.000Z',
        titleEn: 'BTC up',
        bodyEn: 'body',
        titleKo: 'BTC 상승',
        bodyKo: null,
        summaryKo: '요약',
        sentiment: 'bullish' as const,
        category: 'macro' as const,
        priceImpact: 'high' as const,
        tickers: ['BTCUSD'],
        analyzedAt: new Date('2026-06-15T12:00:00.000Z'),
    },
]);

vi.mock('../api', () => ({
    DrizzleMarketNewsRepository: vi.fn(function () {
        return { listByCategory: mockListByCategory };
    }),
    getMarketNewsList: vi.fn(async () => [
        {
            id: 'm1',
            symbol: '__NEWS_CRYPTO__',
            source: 'CoinWire',
            url: 'https://x/btc',
            publishedAt: '2026-06-15T10:00:00.000Z',
            titleEn: 'BTC up',
            bodyEn: 'body',
            titleKo: 'BTC 상승',
            bodyKo: null,
            summaryKo: '요약',
            sentiment: 'bullish',
            category: 'macro',
            priceImpact: 'high',
            tickers: ['BTCUSD'],
            analyzedAt: new Date('2026-06-15T12:00:00.000Z'),
        },
    ]),
}));

import { getMarketNewsCardsAction } from '../actions/getMarketNewsCardsAction';

describe('getMarketNewsCardsAction은', () => {
    it('카테고리에 해당하는 매핑된 카드를 반환한다(tickers 포함)', async () => {
        const cards = await getMarketNewsCardsAction('crypto');
        expect(cards).toHaveLength(1);
        const card = cards[0]!;
        // Core NewsDisplayItem fields
        expect(card.id).toBe('m1');
        expect(card.titleKo).toBe('BTC 상승');
        expect(card.sentiment).toBe('bullish');
        expect(card.source).toBe('CoinWire');
        // Extended: tickers
        expect(card.tickers).toEqual(['BTCUSD']);
    });

    it('빈 버킷이면 빈 배열을 반환한다', async () => {
        const { getMarketNewsList } = await import('../api');
        vi.mocked(getMarketNewsList).mockResolvedValueOnce([]);
        const cards = await getMarketNewsCardsAction('forex');
        expect(cards).toEqual([]);
    });

    it('예외 발생 시 throw하지 않고 빈 배열을 반환한다', async () => {
        const { getMarketNewsList } = await import('../api');
        vi.mocked(getMarketNewsList).mockRejectedValueOnce(
            new Error('db error')
        );
        const cards = await getMarketNewsCardsAction('crypto');
        expect(cards).toEqual([]);
    });
});
