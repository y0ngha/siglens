import type { MockedFunction } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { NewsDisplayItem } from '@/shared/lib/types';
import { useNewsPollingWithInvalidation } from '@/widgets/news/hooks/useNewsPollingWithInvalidation';
import { formatNewsPublishedAt } from '@/shared/lib/timeFormat';
import { NewsList } from '@/widgets/news/sections/NewsList';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';

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

    // 회귀 가드: `titleKo ?? titleEn`(로케일 무관)이 돌아오면 `/en`·`/ja`·`/zh`
    // 뉴스 화면도 한국어 헤드라인을 보여준다.
    it('locale=en에서는 titleEn 헤드라인을 표시한다', () => {
        mockUseNewsPollingWithInvalidation.mockReturnValue({
            items: [READY_ITEM],
            isPolling: false,
            pollError: null,
        });

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });
        renderWithIntl(
            <QueryClientProvider client={queryClient}>
                <NewsList items={[READY_ITEM]} symbol="AAPL" />
            </QueryClientProvider>,
            { locale: 'en' }
        );

        expect(
            screen.getByText('AAPL announces new product')
        ).toBeInTheDocument();
        expect(screen.queryByText('애플, 신제품 발표')).not.toBeInTheDocument();
    });

    /**
     * 회귀 가드: 제목만 로케일을 타던 시절이 실제로 있었다. 사이드카가 요약·본문
     * 번역을 만들어 페이로드에까지 실었는데 카드가 `item.summaryKo`를 그대로
     * 렌더해서, `/ja` 방문자는 번역된 헤드라인 아래 한국어 본문을 봤다. 번역
     * 비용은 매번 나갔고 화면은 "번역된 것처럼" 보여 눈으로는 안 잡혔다.
     */
    it('사이드카 번역이 있으면 본문·요약도 그 언어로 표시한다', () => {
        const localizedItem = {
            ...READY_ITEM,
            bodyLocalized: 'Apple said demand expectations grew.',
            summaryLocalized: 'The launch lifted sentiment.',
        };
        mockUseNewsPollingWithInvalidation.mockReturnValue({
            items: [localizedItem],
            isPolling: false,
            pollError: null,
        });

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });
        renderWithIntl(
            <QueryClientProvider client={queryClient}>
                <NewsList items={[localizedItem]} symbol="AAPL" />
            </QueryClientProvider>,
            { locale: 'en' }
        );

        expect(
            screen.getByText('Apple said demand expectations grew.')
        ).toBeInTheDocument();
        expect(
            screen.getByText('The launch lifted sentiment.')
        ).toBeInTheDocument();
        expect(
            screen.queryByText(
                '애플은 신제품 발표 이후 수요 기대가 커졌다고 밝혔습니다.'
            )
        ).not.toBeInTheDocument();
    });
});
