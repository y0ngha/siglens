vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) =>
        args
            .flat()
            .filter(a => typeof a === 'string' && a.length > 0)
            .join(' '),
}));
vi.mock('@/features/symbol-model', () => ({
    useDefaultModelId: () => 'gemini-3.5-flash-lite',
    useAnalysisSettingsHydrated: () => true,
    useDefaultReasoning: () => false,
}));
vi.mock('../hooks/useFundamentalAnalysis', () => ({
    useFundamentalAnalysis: vi.fn(),
}));
vi.mock('@/features/symbol-chat', () => ({
    usePublishSymbolChat: vi.fn(),
}));
vi.mock('../utils/buildChatState', () => ({
    buildChatState: () => null,
}));
vi.mock('../FundamentalAiSummaryError', () => ({
    FundamentalAiSummaryError: () => <div data-testid="error" />,
}));
vi.mock('../FundamentalAiSummarySkeleton', () => ({
    FundamentalAiSummarySkeleton: () => <div data-testid="skeleton" />,
}));
vi.mock('@/shared/ui/BotBlockedNotice', () => ({
    BotBlockedNotice: () => <div data-testid="bot-blocked" />,
}));

import { render, screen, within } from '@testing-library/react';

import { FundamentalAiSummary } from '../FundamentalAiSummary';
import { usePublishSymbolChat } from '@/features/symbol-chat';
import { useFundamentalAnalysis } from '../hooks/useFundamentalAnalysis';

describe('FundamentalAiSummary', () => {
    /**
     * 페이지가 SSR 스냅샷 프로즈를 보여줄 때 이 위젯은 `hideView`로 마운트된다.
     * UI는 없지만 챗봇 분석 컨텍스트 publish는 계속돼야 한다 — 위젯을 아예
     * 렌더하지 않던 이전 동작에서는 완료된 분석이 있는 종목일수록 챗 입력이
     * "분석이 완료된 후 질문할 수 있어요"로 잠기는 역전이 있었다.
     */
    describe('hideView', () => {
        it('UI를 렌더하지 않는다', () => {
            vi.mocked(useFundamentalAnalysis).mockReturnValue({
                status: 'loading',
                trigger: vi.fn(),
            } as never);

            const { container } = render(
                <FundamentalAiSummary symbol="AAPL" hideView />
            );

            expect(container).toBeEmptyDOMElement();
        });

        it('UI를 숨겨도 챗 컨텍스트 publish는 계속된다', () => {
            vi.mocked(useFundamentalAnalysis).mockReturnValue({
                status: 'done',
                plain: null,
                result: {} as never,
                trigger: vi.fn(),
            } as never);

            render(<FundamentalAiSummary symbol="AAPL" hideView />);

            expect(vi.mocked(usePublishSymbolChat)).toHaveBeenCalled();
        });
    });

    it('renders skeleton during loading', () => {
        vi.mocked(useFundamentalAnalysis).mockReturnValue({
            status: 'loading',
            trigger: vi.fn(),
        });

        render(<FundamentalAiSummary symbol="AAPL" />);

        expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    });

    it('renders bot-blocked notice', () => {
        vi.mocked(useFundamentalAnalysis).mockReturnValue({
            status: 'bot_blocked',
            trigger: vi.fn(),
        });

        render(<FundamentalAiSummary symbol="AAPL" />);

        expect(screen.getByTestId('bot-blocked')).toBeInTheDocument();
    });

    it('renders error component on error', () => {
        vi.mocked(useFundamentalAnalysis).mockReturnValue({
            status: 'error',
            error: new Error('test'),
            retry: vi.fn(),
            trigger: vi.fn(),
        });

        render(<FundamentalAiSummary symbol="AAPL" />);

        expect(screen.getByTestId('error')).toBeInTheDocument();
    });

    it('renders the analysis result on success', () => {
        vi.mocked(useFundamentalAnalysis).mockReturnValue({
            status: 'done',
            plain: null,
            result: {
                overallSentiment: 'bullish',
                overallConclusionKo: '강세 전망입니다',
                categoryAssessments: [],
                riskFactorsKo: [],
            },
            trigger: vi.fn(),
        });

        render(<FundamentalAiSummary symbol="AAPL" />);

        expect(screen.getByText('강세 전망입니다')).toBeInTheDocument();
        expect(screen.getByText('긍정')).toBeInTheDocument();
    });

    it('renders category assessments with per-category sentiment and rationale', () => {
        vi.mocked(useFundamentalAnalysis).mockReturnValue({
            status: 'done',
            plain: null,
            result: {
                overallSentiment: 'bullish',
                overallConclusionKo: '강세 전망입니다',
                categoryAssessments: [
                    {
                        category: 'profitability',
                        sentiment: 'bullish',
                        rationaleKo: '영업이익률이 개선되고 있습니다',
                    },
                    {
                        category: 'valuation',
                        sentiment: 'bearish',
                        rationaleKo: 'PER이 업종 평균 대비 높습니다',
                    },
                ],
                riskFactorsKo: [],
            },
            trigger: vi.fn(),
        });

        render(<FundamentalAiSummary symbol="AAPL" />);

        const list = screen.getByRole('list', { name: '카테고리별 평가' });
        expect(list).toBeInTheDocument();
        expect(
            screen.getByText('영업이익률이 개선되고 있습니다')
        ).toBeInTheDocument();
        expect(
            screen.getByText('PER이 업종 평균 대비 높습니다')
        ).toBeInTheDocument();
        // two category rows -> two sentiment badges, one per assessment.
        expect(within(list).getAllByText('긍정')).toHaveLength(1);
        expect(within(list).getAllByText('부정')).toHaveLength(1);
    });

    it('does not render the category list when categoryAssessments is empty', () => {
        vi.mocked(useFundamentalAnalysis).mockReturnValue({
            status: 'done',
            plain: null,
            result: {
                overallSentiment: 'neutral',
                overallConclusionKo: '중립적인 전망입니다',
                categoryAssessments: [],
                riskFactorsKo: [],
            },
            trigger: vi.fn(),
        });

        render(<FundamentalAiSummary symbol="AAPL" />);

        expect(
            screen.queryByRole('list', { name: '카테고리별 평가' })
        ).not.toBeInTheDocument();
    });

    it('renders risk factors as a bullet list when present', () => {
        vi.mocked(useFundamentalAnalysis).mockReturnValue({
            status: 'done',
            plain: null,
            result: {
                overallSentiment: 'bearish',
                overallConclusionKo: '약세 전망입니다',
                categoryAssessments: [],
                riskFactorsKo: ['원자재 가격 상승', '경쟁 심화'],
            },
            trigger: vi.fn(),
        });

        render(<FundamentalAiSummary symbol="AAPL" />);

        expect(screen.getByText('원자재 가격 상승')).toBeInTheDocument();
        expect(screen.getByText('경쟁 심화')).toBeInTheDocument();
    });

    it('does not render the risk factors section when riskFactorsKo is empty', () => {
        vi.mocked(useFundamentalAnalysis).mockReturnValue({
            status: 'done',
            plain: null,
            result: {
                overallSentiment: 'neutral',
                overallConclusionKo: '중립적인 전망입니다',
                categoryAssessments: [],
                riskFactorsKo: [],
            },
            trigger: vi.fn(),
        });

        render(<FundamentalAiSummary symbol="AAPL" />);

        expect(screen.queryByText('원자재 가격 상승')).not.toBeInTheDocument();
    });
});
