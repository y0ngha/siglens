/**
 * ISR empty-cache prevention tests for the /news/[category] page.
 *
 * A transient throw from getMarketNewsCards during ISR cold-gen must NOT
 * propagate — it must degrade to MarketNewsDegraded (a non-empty, non-0-byte
 * page) rather than freezing an empty ISR cache.
 *
 * Strategy: mock getMarketNewsCards to reject, invoke the RSC directly
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

// getMarketNewsCards will be configured per-test to reject.
vi.mock('@/entities/market-news/api', () => ({
    getMarketNewsCards: vi.fn(),
}));

vi.mock('@/widgets/market-news', async () => ({
    MarketNewsDigest: () => <div data-testid="digest-stub" />,
    // data-count: 서버가 클라이언트로 몇 행을 넘겼는지 관찰한다(직렬화 상한 검증).
    MarketNewsList: ({ initialItems }: { initialItems: { id: string }[] }) => (
        <div
            data-testid="list-stub"
            data-count={initialItems.length}
            data-first={initialItems[0]?.id}
        />
    ),
    // 상수를 여기 손으로 적지 않는다. 페이지가 이 배럴에서 상수를 읽으므로,
    // 숫자를 하드코딩하면 **실제 값이 무엇이든 테스트가 통과해** 상한 검증이 무의미해진다.
    ...(await import('@/widgets/market-news/constants')),
}));

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

import { MARKET_NEWS_ROW_SERIALIZATION_LIMIT } from '@/widgets/market-news/constants';

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
import { getMarketNewsCards } from '@/entities/market-news/api';

const mockGetMarketNewsList = getMarketNewsCards as MockedFunction<
    typeof getMarketNewsCards
>;

describe('/news/[category] ISR empty-cache prevention', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('getMarketNewsCards throw → page does not throw, renders MarketNewsDegraded (non-empty)', async () => {
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

    it('getMarketNewsCards throw → page still renders category tabs and h1 (chrome intact)', async () => {
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

    it('generateMetadata: getMarketNewsCards throw → returns noindex metadata (isEmpty:true path)', async () => {
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
                source: 'CoinWire',
                url: 'https://example.com/btc',
                publishedAt: '2026-06-15T10:00:00.000Z',
                titleEn: 'BTC up',
                titleKo: '비트코인 상승',
                bodyKo: null,
                summaryKo: null,
                sentiment: null,
                category: null,
                priceImpact: null,
                tickers: ['BTCUSD'],
            },
        ] as Awaited<ReturnType<typeof getMarketNewsCards>>);

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

/**
 * 카테고리 뉴스도 종목 뉴스와 같은 직렬화 상한을 쓴다. 화면에는 `PAGE_SIZE`(10)씩만
 * 그리면서 조회 결과를 통째로 넘기고 있던 것을 막는다 — 상한을 지우면 이 테스트가
 * 깨진다.
 */
describe('/news/[category] 직렬화 행 상한', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('상한을 넘으면 상한만큼만 클라이언트로 넘긴다', async () => {
        const rows = Array.from(
            { length: MARKET_NEWS_ROW_SERIALIZATION_LIMIT + 87 },
            (_, i) => ({ id: `c${i}`, sentiment: null })
        ) as unknown as Awaited<ReturnType<typeof getMarketNewsCards>>;
        mockGetMarketNewsList.mockResolvedValue(rows);

        render(
            await CategoryNewsPage({
                params: Promise.resolve({ category: 'crypto' }),
            })
        );

        expect(screen.getByTestId('list-stub').getAttribute('data-count')).toBe(
            String(MARKET_NEWS_ROW_SERIALIZATION_LIMIT)
        );
        // 남기는 쪽은 앞(최신)이다 — `slice(-N)`이면 가장 오래된 50건만 첫 페인트에
        // 남는데 렌더는 멀쩡해서 아무도 눈치채지 못한다.
        expect(screen.getByTestId('list-stub').getAttribute('data-first')).toBe(
            'c0'
        );
    });
});
