import { vi, type MockedFunction } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { NewsDisplayItem } from '@/shared/lib/types';
import { useNewsPollingWithInvalidation } from '@/widgets/news/hooks/useNewsPollingWithInvalidation';
import {
    formatNewsPublishedAt,
    NewsList,
} from '@/widgets/news/sections/NewsList';

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
    return render(
        <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    );
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
        expect(formatNewsPublishedAt('2026-05-05T22:35:21.000Z')).toBe(
            '2026년 5월 6일 오전 07:35 KST'
        );
    });
});
