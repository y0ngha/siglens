import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {} })),
}));
vi.mock('@/shared/lib/sleep', () => ({ sleep: vi.fn() }));
vi.mock('../lib/marketNewsRefreshFlag', () => ({
    isRecentlyFetched: vi.fn(async () => false),
    markFetched: vi.fn(async () => undefined),
}));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: vi.fn(() => false) }));

// Mock submitNewsCardAnalysis / pollNewsCardAnalysis from core
vi.mock('@y0ngha/siglens-core', async importOriginal => {
    const original =
        await importOriginal<typeof import('@y0ngha/siglens-core')>();
    return {
        ...original,
        submitNewsCardAnalysis: vi.fn(async () => ({ jobId: 'job-1' })),
        pollNewsCardAnalysis: vi.fn(async () => ({
            status: 'done',
            result: {
                titleKo: 'BTC 상승',
                bodyKo: null,
                summaryKo: '요약',
                sentiment: 'bullish',
                category: 'macro',
                priceImpact: 'high',
            },
        })),
    };
});

// Shared mock implementations
const mockUpsertMarketNewsItem = vi.fn(async () => true);
const mockAttachAnalysis = vi.fn(async () => undefined);
const mockListByCategory = vi.fn(async () => [
    {
        id: 'm1',
        symbol: '__NEWS_CRYPTO__',
        source: 'CoinWire',
        url: 'https://x/btc',
        publishedAt: '2026-06-15T10:00:00.000Z',
        titleEn: 'BTC up',
        bodyEn: 'body',
        titleKo: null,
        bodyKo: null,
        summaryKo: null,
        sentiment: null,
        category: null,
        priceImpact: null,
        tickers: ['BTCUSD'],
        analyzedAt: null,
    },
]);

vi.mock('../api', () => ({
    DrizzleMarketNewsRepository: vi.fn(function () {
        return {
            upsertMarketNewsItem: mockUpsertMarketNewsItem,
            attachAnalysis: mockAttachAnalysis,
            listByCategory: mockListByCategory,
        };
    }),
    getMarketNewsList: vi.fn(),
}));

const mockFetchCategoryNews = vi.fn(async () => [
    {
        id: 'm1',
        symbol: '__NEWS_CRYPTO__',
        source: 'CoinWire',
        url: 'https://x/btc',
        publishedAt: '2026-06-15T10:00:00.000Z',
        titleEn: 'BTC up',
        bodyEn: 'body',
        tickers: ['BTCUSD'],
    },
]);

vi.mock('../lib/getMarketNewsClient', () => ({
    getMarketNewsClient: vi.fn(() => ({
        fetchCategoryNews: mockFetchCategoryNews,
    })),
}));

// Import action after all mocks are set up
import { ensureMarketNewsCardsAnalyzedAction } from '../actions/ensureMarketNewsCardsAnalyzedAction';

describe('ensureMarketNewsCardsAnalyzedAction은', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUpsertMarketNewsItem.mockResolvedValue(true);
        mockListByCategory.mockResolvedValue([
            {
                id: 'm1',
                symbol: '__NEWS_CRYPTO__',
                source: 'CoinWire',
                url: 'https://x/btc',
                publishedAt: '2026-06-15T10:00:00.000Z',
                titleEn: 'BTC up',
                bodyEn: 'body',
                titleKo: null,
                bodyKo: null,
                summaryKo: null,
                sentiment: null,
                category: null,
                priceImpact: null,
                tickers: ['BTCUSD'],
                analyzedAt: null,
            },
        ]);
        mockFetchCategoryNews.mockResolvedValue([
            {
                id: 'm1',
                symbol: '__NEWS_CRYPTO__',
                source: 'CoinWire',
                url: 'https://x/btc',
                publishedAt: '2026-06-15T10:00:00.000Z',
                titleEn: 'BTC up',
                bodyEn: 'body',
                tickers: ['BTCUSD'],
            },
        ]);
    });

    it('새 기사를 upsert하면 market-news:<sentinel> 태그를 revalidate한다', async () => {
        const { revalidateTag } = await import('next/cache');
        await ensureMarketNewsCardsAnalyzedAction('crypto');
        expect(revalidateTag).toHaveBeenCalledWith(
            'market-news:__NEWS_CRYPTO__',
            'max'
        );
    });

    it('upsert가 변경 없이 끝나면(false) revalidateTag를 호출하지 않는다', async () => {
        mockUpsertMarketNewsItem.mockResolvedValue(false);
        const { revalidateTag } = await import('next/cache');
        await ensureMarketNewsCardsAnalyzedAction('crypto');
        expect(revalidateTag).not.toHaveBeenCalled();
    });

    it('봇(skipAnalysis)이고 최근 fetch했으면 FMP fetch를 건너뛴다', async () => {
        const { isRecentlyFetched } =
            await import('../lib/marketNewsRefreshFlag');
        vi.mocked(isRecentlyFetched).mockResolvedValue(true);

        const { getMarketNewsClient } =
            await import('../lib/getMarketNewsClient');
        await ensureMarketNewsCardsAnalyzedAction('crypto', {
            skipAnalysis: true,
        });
        expect(getMarketNewsClient).not.toHaveBeenCalled();
    });
});
