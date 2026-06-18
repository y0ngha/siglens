// 1. All vi.mock(...) calls — hoisted by Vitest before any static import
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {} })),
}));
vi.mock('@/shared/lib/sleep', () => ({ sleep: vi.fn() }));
// isRecentlyFetched / markFetched are now in ../api — injected into the api mock below.
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
    isRecentlyFetched: vi.fn(async () => false),
    markFetched: vi.fn(async () => undefined),
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

// 2. Static imports — grouped after all vi.mock() calls
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ensureMarketNewsCardsAnalyzedAction } from '../actions/ensureMarketNewsCardsAnalyzedAction';

// 3. Item fixtures for majority-failure test
function makeItem(id: string) {
    return {
        id,
        symbol: '__NEWS_CRYPTO__',
        source: 'CoinWire',
        url: `https://x/${id}`,
        publishedAt: '2026-06-15T10:00:00.000Z',
        titleEn: `Headline ${id}`,
        bodyEn: 'body',
        tickers: [] as string[],
    };
}

const ITEMS = ['m1', 'm2', 'm3', 'm4', 'm5'].map(makeItem);

// 3. Tests
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
        const { isRecentlyFetched } = await import('../api');
        vi.mocked(isRecentlyFetched).mockResolvedValue(true);

        const { getMarketNewsClient } =
            await import('../lib/getMarketNewsClient');
        await ensureMarketNewsCardsAnalyzedAction('crypto', {
            skipAnalysis: true,
        });
        expect(getMarketNewsClient).not.toHaveBeenCalled();
    });

    it('skipAnalysis=true이고 최근 fetch가 아니면 FMP fetch와 upsert는 진행하되 LLM 분석은 건너뛴다', async () => {
        const { isRecentlyFetched, markFetched } = await import('../api');
        vi.mocked(isRecentlyFetched).mockResolvedValue(false);

        const { submitNewsCardAnalysis } = await import('@y0ngha/siglens-core');

        await ensureMarketNewsCardsAnalyzedAction('crypto', {
            skipAnalysis: true,
        });

        // FMP fetch proceeded
        expect(mockFetchCategoryNews).toHaveBeenCalled();
        // Upsert ran for the fetched items
        expect(mockUpsertMarketNewsItem).toHaveBeenCalled();
        // LLM analysis was NOT triggered
        expect(submitNewsCardAnalysis).not.toHaveBeenCalled();
        // Refresh flag was still marked (action uses sentinel, not slug)
        expect(vi.mocked(markFetched)).toHaveBeenCalledWith('__NEWS_CRYPTO__');
    });

    it('예외가 발생해도 throw하지 않고 void를 반환한다', async () => {
        mockFetchCategoryNews.mockRejectedValue(new Error('network error'));
        // Should resolve without throwing
        await expect(
            ensureMarketNewsCardsAnalyzedAction('crypto')
        ).resolves.toBeUndefined();
    });

    it('majority upsert failure이면 console.error 후 early return하고 LLM 분석을 호출하지 않는다', async () => {
        // 5 fresh items, 3 upsert rejections → majority (3 > 5/2 = 2.5)
        mockFetchCategoryNews.mockResolvedValueOnce(ITEMS);
        // fulfilled, rejected, rejected, fulfilled, rejected → 3 failures out of 5
        mockUpsertMarketNewsItem
            .mockResolvedValueOnce(true)
            .mockRejectedValueOnce(new Error('db write error'))
            .mockRejectedValueOnce(new Error('db write error'))
            .mockResolvedValueOnce(true)
            .mockRejectedValueOnce(new Error('db write error'));

        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        const { submitNewsCardAnalysis } = await import('@y0ngha/siglens-core');
        await ensureMarketNewsCardsAnalyzedAction('crypto');

        // Majority branch should fire and abort before LLM analysis
        expect(submitNewsCardAnalysis).not.toHaveBeenCalled();

        errorSpy.mockRestore();
    });

    it('minority upsert failure(2/5)이면 LLM 분석을 계속 진행한다', async () => {
        mockFetchCategoryNews.mockResolvedValueOnce(ITEMS); // 5 items
        // 2 failures of 5 → NOT majority (2 ≤ 5/2 = 2.5)
        mockUpsertMarketNewsItem
            .mockRejectedValueOnce(new Error('err'))
            .mockRejectedValueOnce(new Error('err'))
            .mockResolvedValue(true);

        const { submitNewsCardAnalysis } = await import('@y0ngha/siglens-core');
        await ensureMarketNewsCardsAnalyzedAction('crypto');

        // minority failure should NOT abort — LLM analysis should still run
        expect(submitNewsCardAnalysis).toHaveBeenCalled();
    });
});
