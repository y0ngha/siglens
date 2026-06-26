/**
 * ISR empty-cache prevention tests for the /news/[category] page.
 *
 * A transient throw from getMarketNewsList during ISR cold-gen must NOT
 * propagate — it must degrade to MarketNewsDegraded (a non-empty, non-0-byte
 * page) rather than freezing an empty ISR cache.
 *
 * Strategy: mock getMarketNewsList to reject, invoke the RSC directly
 * (via render), and confirm MarketNewsDegraded renders.
 * Mirrors page.test.tsx mocking pattern.
 */

vi.mock('next/navigation', () => ({
    notFound: vi.fn(() => {
        throw new Error('NEXT_NOT_FOUND');
    }),
}));

// staticSymbolCache: call fetcher() directly so tests stay pure.
vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: vi.fn(
        (
            _key: readonly string[],
            _symbol: string,
            fetcher: () => Promise<unknown>
        ) => fetcher()
    ),
}));

// getMarketNewsList will be configured per-test to reject.
vi.mock('@/entities/market-news/api', () => ({
    getMarketNewsList: vi.fn(),
}));

vi.mock('@/widgets/market-news', () => ({
    MarketNewsDigest: () => <div data-testid="digest-stub" />,
    MarketNewsList: () => <div data-testid="list-stub" />,
}));

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

import {
    describe,
    it,
    expect,
    vi,
    beforeEach,
    type MockedFunction,
} from 'vitest';
import { render, screen } from '@testing-library/react';
import CategoryNewsPage from '../page';
import { getMarketNewsList } from '@/entities/market-news/api';

const mockGetMarketNewsList = getMarketNewsList as MockedFunction<
    typeof getMarketNewsList
>;

describe('/news/[category] ISR empty-cache prevention', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('getMarketNewsList throw → page does not throw, renders MarketNewsDegraded (non-empty)', async () => {
        // Simulate transient DB failure during ISR cold-gen.
        mockGetMarketNewsList.mockRejectedValue(
            new Error('DB connection refused')
        );

        // Must NOT reject — the .catch(() => []) in loadCategorySnapshot must absorb the throw.
        render(
            await CategoryNewsPage({
                params: Promise.resolve({ category: 'crypto' }),
            })
        );

        // MarketNewsDegraded renders the degrade notice — page is non-empty.
        expect(
            screen.getByText(/최근 뉴스를 불러오지 못했어요/)
        ).toBeInTheDocument();
    });

    it('getMarketNewsList throw → page still renders category tabs and h1 (chrome intact)', async () => {
        mockGetMarketNewsList.mockRejectedValue(
            new Error('DB connection refused')
        );

        render(
            await CategoryNewsPage({
                params: Promise.resolve({ category: 'crypto' }),
            })
        );

        // h1 must be present — page is not a blank 0-byte result.
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    it('generateMetadata: getMarketNewsList throw → returns noindex metadata (isEmpty:true path)', async () => {
        mockGetMarketNewsList.mockRejectedValue(
            new Error('DB connection refused')
        );

        const { generateMetadata } = await import('../page');
        const meta = await generateMetadata({
            params: Promise.resolve({ category: 'crypto' }),
        });

        // isEmpty:true → noindex + canonical null (same as the existing empty-data path).
        expect((meta.robots as { index: boolean } | undefined)?.index).toBe(
            false
        );
        expect(meta.alternates?.canonical).toBeNull();
    });

    it('success path unchanged — normal data → MarketNewsDegraded NOT shown', async () => {
        mockGetMarketNewsList.mockResolvedValue([
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
        ] as Awaited<ReturnType<typeof getMarketNewsList>>);

        render(
            await CategoryNewsPage({
                params: Promise.resolve({ category: 'crypto' }),
            })
        );

        // Normal data path — degrade notice should NOT be visible.
        expect(
            screen.queryByText(/최근 뉴스를 불러오지 못했어요/)
        ).not.toBeInTheDocument();
    });
});
