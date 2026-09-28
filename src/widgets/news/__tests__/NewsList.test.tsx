import type { MockedFunction } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { NewsDisplayItem } from '@/shared/lib/types';
import { useNewsPollingWithInvalidation } from '@/widgets/news/hooks/useNewsPollingWithInvalidation';
import { formatNewsPublishedAt } from '@/shared/lib/timeFormat';
import { NewsList } from '@/widgets/news/sections/NewsList';
import { NEWS_LIST_PAGE_SIZE } from '@/shared/config/newsSerialization';

vi.mock('@/widgets/news/hooks/useNewsPollingWithInvalidation', () => ({
    useNewsPollingWithInvalidation: vi.fn(),
}));

const mockUseNewsPollingWithInvalidation =
    useNewsPollingWithInvalidation as MockedFunction<
        typeof useNewsPollingWithInvalidation
    >;

function renderWithClient(ui: React.ReactElement) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    const result = render(
        <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    );
    return {
        ...result,
        rerenderWithClient: (nextUi: React.ReactElement) =>
            result.rerender(
                <QueryClientProvider client={queryClient}>
                    {nextUi}
                </QueryClientProvider>
            ),
    };
}

const READY_ITEM: NewsDisplayItem = {
    id: 'news-1',
    publishedAt: '2026-05-06T00:00:00.000Z',
    titleEn: 'AAPL announces new product',
    titleKo: '애플, 신제품 발표',
    sentiment: 'bullish',
    category: 'earnings',
    bodyKo: '애플은 신제품 발표 이후 수요 기대가 커졌다고 밝혔습니다.',
    summaryKo: '신제품 발표가 투자심리에 긍정적으로 작용했습니다.',
    priceImpact: 'medium',
    url: 'https://example.com/news-1',
    source: 'Example',
};

describe('NewsList', () => {
    beforeEach(() => {
        mockUseNewsPollingWithInvalidation.mockReset();
    });

    it('기존 뉴스가 있어도 최신 뉴스 확인 중이면 상단 상태 카드를 표시한다', () => {
        mockUseNewsPollingWithInvalidation.mockReturnValue({
            items: [READY_ITEM],
            isPolling: true,
            pollError: null,
        });

        renderWithClient(<NewsList items={[READY_ITEM]} symbol="AAPL" />);

        expect(screen.getByText('최신 뉴스 확인 중…')).toBeInTheDocument();
        expect(screen.getByText('애플, 신제품 발표')).toBeInTheDocument();
    });

    it('최신 뉴스 확인이 끝나면 상단 상태 카드를 제거한다', () => {
        mockUseNewsPollingWithInvalidation.mockReturnValue({
            items: [READY_ITEM],
            isPolling: false,
            pollError: null,
        });

        renderWithClient(<NewsList items={[READY_ITEM]} symbol="AAPL" />);

        expect(
            screen.queryByText('최신 뉴스 확인 중…')
        ).not.toBeInTheDocument();
        expect(screen.getByText('애플, 신제품 발표')).toBeInTheDocument();
    });

    it('분석 완료 뉴스는 본문과 요약을 구분해 표시한다', () => {
        mockUseNewsPollingWithInvalidation.mockReturnValue({
            items: [READY_ITEM],
            isPolling: false,
            pollError: null,
        });

        renderWithClient(<NewsList items={[READY_ITEM]} symbol="AAPL" />);

        expect(screen.getByText('본문')).toBeInTheDocument();
        expect(
            screen.getByText(
                '애플은 신제품 발표 이후 수요 기대가 커졌다고 밝혔습니다.'
            )
        ).toBeInTheDocument();
        expect(screen.getByText('요약')).toBeInTheDocument();
        expect(
            screen.getByText(
                '신제품 발표가 투자심리에 긍정적으로 작용했습니다.'
            )
        ).toBeInTheDocument();
    });

    it('뉴스 시간을 한국시간 기준으로 표시한다', () => {
        expect(formatNewsPublishedAt('2026-05-05T22:35:21.000Z', 'ko')).toBe(
            '2026년 5월 6일 오전 07:35 KST'
        );
    });

    it('impact badge는 자산 중립 "가격 영향" 레이블을 사용한다 (equity·crypto 공용)', () => {
        // NewsList is rendered on both equity and crypto news pages, so the label
        // must be asset-neutral ("가격") rather than equity-specific ("주가").
        mockUseNewsPollingWithInvalidation.mockReturnValue({
            items: [READY_ITEM], // READY_ITEM has priceImpact: 'medium'
            isPolling: false,
            pollError: null,
        });

        renderWithClient(<NewsList items={[READY_ITEM]} symbol="BTCUSD" />);

        // Must render "가격 영향 보통", not "주가 영향 보통".
        expect(screen.getByText('가격 영향 보통')).toBeInTheDocument();
        expect(screen.queryByText('주가 영향 보통')).not.toBeInTheDocument();
    });

    /**
     * 초기 DOM 카드 수는 `/[symbol]/news`의 `ItemList` 구조화데이터 상한과 같은
     * 상수여야 한다. "더보기"로 늘어난 카드는 클라이언트 상태에만 있어 크롤러가
     * 보지 못하므로, 여기가 곧 마크업이 주장해도 되는 최대 개수다.
     */
    it(`처음에는 NEWS_LIST_PAGE_SIZE(${NEWS_LIST_PAGE_SIZE})개만 그린다`, () => {
        const manyItems = Array.from(
            { length: NEWS_LIST_PAGE_SIZE * 2 },
            (_, i) => ({ ...READY_ITEM, id: `news-${i}` })
        );
        mockUseNewsPollingWithInvalidation.mockReturnValue({
            items: manyItems,
            isPolling: false,
            pollError: null,
        });

        renderWithClient(<NewsList items={manyItems} symbol="AAPL" />);

        expect(screen.getAllByRole('article')).toHaveLength(
            NEWS_LIST_PAGE_SIZE
        );
    });

    it('"더보기" 클릭 시 남은 개수만큼 카드를 더 렌더한다', async () => {
        const user = userEvent.setup();
        const manyItems = Array.from(
            { length: NEWS_LIST_PAGE_SIZE * 2 },
            (_, i) => ({ ...READY_ITEM, id: `news-${i}` })
        );
        mockUseNewsPollingWithInvalidation.mockReturnValue({
            items: manyItems,
            isPolling: false,
            pollError: null,
        });

        renderWithClient(<NewsList items={manyItems} symbol="AAPL" />);

        expect(screen.getAllByRole('article')).toHaveLength(
            NEWS_LIST_PAGE_SIZE
        );
        const remaining = manyItems.length - NEWS_LIST_PAGE_SIZE;
        const moreButton = screen.getByRole('button', {
            name: `더보기 (${remaining}개 남음)`,
        });

        await user.click(moreButton);

        expect(screen.getAllByRole('article')).toHaveLength(manyItems.length);
        // All items are now visible, so the "load more" button disappears.
        expect(
            screen.queryByRole('button', { name: /더보기/ })
        ).not.toBeInTheDocument();
    });

    describe('빈 뉴스 목록', () => {
        it('폴링 중이면 로딩 스켈레톤을 3개 그리고 aria-busy를 표시한다', () => {
            mockUseNewsPollingWithInvalidation.mockReturnValue({
                items: [],
                isPolling: true,
                pollError: null,
            });

            renderWithClient(<NewsList items={[]} symbol="AAPL" />);

            const section = screen
                .getByRole('heading', { name: '최근 뉴스' })
                .closest('section');
            expect(section).toHaveAttribute('aria-busy', 'true');
            // Skeleton cards are visual placeholders only.
            expect(
                document.querySelectorAll('article[aria-hidden="true"]')
            ).toHaveLength(3);
        });

        it('폴링이 끝났고 뉴스가 없으면 빈 상태 안내 문구를 그린다', () => {
            mockUseNewsPollingWithInvalidation.mockReturnValue({
                items: [],
                isPolling: false,
                pollError: null,
            });

            renderWithClient(<NewsList items={[]} symbol="AAPL" />);

            expect(screen.queryByRole('article')).not.toBeInTheDocument();
            expect(
                screen.getByText(/동안 들어온 뉴스가 없어요/)
            ).toBeInTheDocument();
        });
    });

    it('pollError는 에러 바운더리가 잡도록 렌더 중 throw한다', () => {
        mockUseNewsPollingWithInvalidation.mockReturnValue({
            items: [],
            isPolling: false,
            pollError: new Error('poll failed'),
        });

        expect(() =>
            renderWithClient(<NewsList items={[]} symbol="AAPL" />)
        ).toThrow('poll failed');
    });

    it('분석 대기 중인 뉴스(sentiment/priceImpact가 null)는 배지 대신 스켈레톤을 그린다', () => {
        const pendingItem: NewsDisplayItem = {
            ...READY_ITEM,
            id: 'news-pending',
            sentiment: null,
            priceImpact: null,
        };
        mockUseNewsPollingWithInvalidation.mockReturnValue({
            items: [pendingItem],
            isPolling: false,
            pollError: null,
        });

        renderWithClient(<NewsList items={[pendingItem]} symbol="AAPL" />);

        expect(screen.getByText('AI 분석 중…')).toBeInTheDocument();
        // Ready-state badges/body must not render while pending.
        expect(screen.queryByText('본문')).not.toBeInTheDocument();
        expect(screen.queryByText('원문 보기 →')).not.toBeInTheDocument();
    });

    it('symbol이 바뀌면 더보기로 늘어난 visibleCount를 페이지 크기로 되돌린다', () => {
        const manyItems = Array.from(
            { length: NEWS_LIST_PAGE_SIZE * 2 },
            (_, i) => ({ ...READY_ITEM, id: `news-${i}` })
        );
        mockUseNewsPollingWithInvalidation.mockReturnValue({
            items: manyItems,
            isPolling: false,
            pollError: null,
        });

        const { rerenderWithClient } = renderWithClient(
            <NewsList items={manyItems} symbol="AAPL" />
        );
        expect(screen.getAllByRole('article')).toHaveLength(
            NEWS_LIST_PAGE_SIZE
        );

        const otherSymbolItems = manyItems.map(item => ({
            ...item,
            id: `${item.id}-msft`,
        }));
        mockUseNewsPollingWithInvalidation.mockReturnValue({
            items: otherSymbolItems,
            isPolling: false,
            pollError: null,
        });

        rerenderWithClient(<NewsList items={otherSymbolItems} symbol="MSFT" />);

        // A fresh symbol resets pagination back to the first page.
        expect(screen.getAllByRole('article')).toHaveLength(
            NEWS_LIST_PAGE_SIZE
        );
    });
});
