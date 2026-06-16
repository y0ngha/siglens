import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({
    notFound: vi.fn(() => {
        throw new Error('NEXT_NOT_FOUND');
    }),
}));

// Mock staticSymbolCache to return a non-empty snapshot for valid categories.
// Factory is fully self-contained — cannot reference outer-scope consts because
// vi.mock factories are hoisted before variable initialization.
vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: vi.fn().mockResolvedValue([
        {
            id: 'r1',
            symbol: '__NEWS_CRYPTO__',
            source: 'CoinWire',
            url: 'https://example.com/btc',
            publishedAt: '2026-06-15T10:00:00.000Z',
            titleEn: 'BTC up',
            titleKo: '비트코인 상승',
            bodyEn: null,
            bodyKo: null,
            summaryKo: null,
            sentiment: null,
            category: null,
            priceImpact: null,
            tickers: ['BTCUSD'],
            analyzedAt: null,
        },
    ]),
}));

// Mock getMarketNewsList to avoid DB in tests
vi.mock('@/entities/market-news/api', () => ({
    getMarketNewsList: vi.fn().mockResolvedValue([]),
}));

import { generateMetadata } from '../page';

describe('/news/[category] generateMetadata는', () => {
    it('유효 카테고리면 canonical /news/<slug>를 설정한다', async () => {
        const meta = await generateMetadata({
            params: Promise.resolve({ category: 'crypto' }),
        });
        expect(meta.alternates?.canonical).toBe('/news/crypto');
        expect(String(meta.title)).toContain('암호화폐');
    });

    it('유효하지 않은 카테고리면 noindex 메타를 반환한다', async () => {
        const meta = await generateMetadata({
            params: Promise.resolve({ category: 'bogus' }),
        });
        expect(meta.robots).toMatchObject({ index: false });
    });
});
