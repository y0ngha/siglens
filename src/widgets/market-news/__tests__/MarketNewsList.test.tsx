/**
 * Component rendering tests for MarketNewsList.
 *
 * Mocks `useMarketNewsCardPolling` directly — it is the only async surface.
 * All other rendering is deterministic from props.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MockedFunction } from 'vitest';
import type { MarketNewsCardItem } from '@/entities/market-news';
import { MARKET_NEWS_LOOKBACK_DAYS } from '@/entities/market-news';
import { useMarketNewsCardPolling } from '@/widgets/market-news/hooks/useMarketNewsCardPolling';
import { MarketNewsList } from '@/widgets/market-news/MarketNewsList';

vi.mock('@/widgets/market-news/hooks/useMarketNewsCardPolling', () => ({
    useMarketNewsCardPolling: vi.fn(),
}));

// next/link renders a plain <a> in test environments — no router needed.
vi.mock('next/link', () => ({
    default: ({
        href,
        children,
        ...props
    }: {
        href: string;
        children: React.ReactNode;
        [key: string]: unknown;
    }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

const mockUseMarketNewsCardPolling = useMarketNewsCardPolling as MockedFunction<
    typeof useMarketNewsCardPolling
>;

const PAGE_SIZE = 10; // mirrors the const in MarketNewsList.tsx
import { MARKET_NEWS_ROW_SERIALIZATION_LIMIT } from '@/widgets/market-news/constants';

function makeItem(n: number): MarketNewsCardItem {
    return {
        id: `mn-${n}`,
        publishedAt: '2026-06-15T10:00:00.000Z',
        titleEn: `News headline ${n}`,
        titleKo: `뉴스 헤드라인 ${n}`,
        sentiment: 'bullish',
        category: 'macro',
        bodyKo: null,
        summaryKo: `요약 ${n}`,
        priceImpact: 'medium',
        url: `https://example.com/news-${n}`,
        source: 'Reuters',
        tickers: [],
    };
}

/** Build an array of N enriched items. */
function makeItems(count: number): MarketNewsCardItem[] {
    return Array.from({ length: count }, (_, i) => makeItem(i + 1));
}

describe('MarketNewsList', () => {
    beforeEach(() => {
        mockUseMarketNewsCardPolling.mockReset();
    });

    it('pollError !== null → throws the error (caught by nearest error boundary)', () => {
        const pollError = new Error('DB connection failed');
        mockUseMarketNewsCardPolling.mockReturnValue({
            items: [],
            isPolling: false,
            pollError,
        });

        // MarketNewsList throws pollError directly when it is not null.
        expect(() =>
            render(<MarketNewsList category="general" initialItems={[]} />)
        ).toThrow(pollError);
    });

    it('items.length === 0 && isPolling=true → renders LoadingState (skeletons + aria-busy)', () => {
        mockUseMarketNewsCardPolling.mockReturnValue({
            items: [],
            isPolling: true,
            pollError: null,
        });

        render(<MarketNewsList category="general" initialItems={[]} />);

        // The section heading is present inside the loading state.
        expect(screen.getByText('최신 시장 뉴스')).toBeInTheDocument();
        // aria-busy="true" on the section.
        const section = screen.getByText('최신 시장 뉴스').closest('section');
        expect(section).toHaveAttribute('aria-busy', 'true');
        // Polling status label.
        expect(screen.getByText('뉴스 수집 중…')).toBeInTheDocument();
    });

    it('items.length === 0 && isPolling=false → renders empty-state copy', () => {
        mockUseMarketNewsCardPolling.mockReturnValue({
            items: [],
            isPolling: false,
            pollError: null,
        });

        render(<MarketNewsList category="crypto" initialItems={[]} />);

        expect(
            screen.getByText(
                `지난 ${MARKET_NEWS_LOOKBACK_DAYS}일 동안 들어온 뉴스가 없어요.`
            )
        ).toBeInTheDocument();
    });

    it('category prop changes → visibleCount resets to PAGE_SIZE', () => {
        const manyItems = makeItems(PAGE_SIZE + 5);

        mockUseMarketNewsCardPolling.mockReturnValue({
            items: manyItems,
            isPolling: false,
            pollError: null,
        });

        const { rerender } = render(
            <MarketNewsList category="general" initialItems={manyItems} />
        );

        // Initially PAGE_SIZE cards are shown.
        expect(screen.getAllByRole('article').length).toBeLessThanOrEqual(
            PAGE_SIZE
        );

        // Switch category — visibleCount should reset.
        rerender(<MarketNewsList category="stock" initialItems={manyItems} />);

        const articles = screen.getAllByRole('article');
        expect(articles.length).toBeLessThanOrEqual(PAGE_SIZE);
    });

    it('click "더 보기" → more cards become visible', async () => {
        const manyItems = makeItems(PAGE_SIZE + 3);

        mockUseMarketNewsCardPolling.mockReturnValue({
            items: manyItems,
            isPolling: false,
            pollError: null,
        });

        const user = userEvent.setup();

        render(<MarketNewsList category="general" initialItems={manyItems} />);

        // Before click: at most PAGE_SIZE articles.
        const beforeCount = screen.getAllByRole('article').length;
        expect(beforeCount).toBeLessThanOrEqual(PAGE_SIZE);

        // Click "더보기" button.
        const moreButton = screen.getByRole('button', { name: /더보기/ });
        await user.click(moreButton);

        // After click: more articles visible.
        const afterCount = screen.getAllByRole('article').length;
        expect(afterCount).toBeGreaterThan(beforeCount);
        expect(afterCount).toBe(manyItems.length);
    });
});

/**
 * 폴링이 부르는 액션과 서버 렌더가 같은 상한을 쓰는지 고정한다. 한쪽만 자르면
 * 첫 페인트의 "더보기 (N개 남음)"이 폴링 직후 실제 전체 개수로 튄다.
 */
describe('MarketNewsList — 직렬화 상한', () => {
    afterEach(() => {
        mockUseMarketNewsCardPolling.mockReset();
    });

    it('폴링이 상한을 넘겨 돌려줘도 상한까지만 다룬다', () => {
        mockUseMarketNewsCardPolling.mockReturnValue({
            items: makeItems(MARKET_NEWS_ROW_SERIALIZATION_LIMIT + 137),
            isPolling: false,
            pollError: null,
        });

        render(
            <MarketNewsList
                category="general"
                initialItems={makeItems(MARKET_NEWS_ROW_SERIALIZATION_LIMIT)}
            />
        );

        // 상한이 없으면 (50+137) - 10 = 177개 남음이 된다.
        const remaining = MARKET_NEWS_ROW_SERIALIZATION_LIMIT - PAGE_SIZE;
        expect(
            screen.getByRole('button', { name: `더보기 (${remaining}개 남음)` })
        ).toBeInTheDocument();
        // 남기는 쪽은 앞(최신)이다 — `slice(-N)`이면 138번째부터 그린다.
        expect(screen.getByText('뉴스 헤드라인 1')).toBeInTheDocument();
    });
});
