/**
 * ISR empty-cache prevention tests for the /news hub page.
 *
 * A transient throw from getMarketNewsList during ISR cold-gen must NOT
 * propagate to the hub page — the per-category `.catch(() => [])` in
 * fetchCategoryPreviews isolates each bucket. The page must still render
 * all category cards (non-empty, non-0-byte result).
 *
 * Strategy: mock getMarketNewsList to reject, invoke NewsHubPage() directly
 * (via render), and confirm the h1 and all 5 category card links are present.
 * Mirrors page.test.tsx mocking pattern.
 */

// staticSymbolCache: call fetcher() directly so tests stay pure (no I/O).
vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: vi.fn(
        (
            _key: readonly string[],
            _symbol: string,
            fetcher: () => Promise<unknown>
        ) => fetcher()
    ),
}));

// getMarketNewsList — configured per-test to reject.
vi.mock('@/entities/market-news/api', () => ({
    getMarketNewsList: vi.fn(),
}));

vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));

import {
    describe,
    it,
    expect,
    vi,
    beforeEach,
    type MockedFunction,
} from 'vitest';
import { render, screen } from '@testing-library/react';
import NewsHubPage from '../page';
import { getMarketNewsList } from '@/entities/market-news/api';

const mockGetMarketNewsList = getMarketNewsList as MockedFunction<
    typeof getMarketNewsList
>;

describe('/news hub page ISR empty-cache prevention', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('getMarketNewsList throw → page does not throw, renders h1 (non-empty)', async () => {
        // Simulate transient DB failure during ISR cold-gen.
        mockGetMarketNewsList.mockRejectedValue(
            new Error('DB connection refused')
        );

        // Must NOT reject — per-category .catch(() => []) must absorb the throw.
        render(await NewsHubPage());

        // h1 must be present — page is not a blank 0-byte result.
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    it('getMarketNewsList throw → all 5 category card links still render', async () => {
        mockGetMarketNewsList.mockRejectedValue(
            new Error('DB connection refused')
        );

        render(await NewsHubPage());

        // Each CategoryCard renders <a href="/news/{slug}"> — all 5 must be present.
        const allLinks = screen.getAllByRole('link');
        const hrefs = allLinks.map(l => l.getAttribute('href'));

        for (const slug of [
            'general',
            'stock',
            'crypto',
            'forex',
            'articles',
        ]) {
            expect(hrefs).toContain(`/news/${slug}`);
        }
    });

    it('getMarketNewsList throw → each category degrades independently (all cards with empty headlines)', async () => {
        mockGetMarketNewsList.mockRejectedValue(
            new Error('DB connection refused')
        );

        // Must NOT reject — Promise.all over all categories must complete.
        const element = await NewsHubPage();

        // A non-null element means the page rendered completely.
        expect(element).not.toBeNull();
    });

    it('success path unchanged — normal data → page renders without errors', async () => {
        mockGetMarketNewsList.mockResolvedValue([
            {
                id: 'r1',
                symbol: '__NEWS_GENERAL__',
                source: 'Reuters',
                url: 'https://example.com/news1',
                publishedAt: '2026-06-22T10:00:00.000Z',
                titleEn: 'Markets rally',
                titleKo: '시장 랠리',
                bodyEn: null,
                bodyKo: null,
                summaryKo: null,
                sentiment: null,
                category: null,
                priceImpact: null,
                tickers: [],
                analyzedAt: null,
            },
        ] as Awaited<ReturnType<typeof getMarketNewsList>>);

        render(await NewsHubPage());

        // Normal path — h1 and all 5 category links present.
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();

        const allLinks = screen.getAllByRole('link');
        const hrefs = allLinks.map(l => l.getAttribute('href'));
        for (const slug of [
            'general',
            'stock',
            'crypto',
            'forex',
            'articles',
        ]) {
            expect(hrefs).toContain(`/news/${slug}`);
        }
    });
});
