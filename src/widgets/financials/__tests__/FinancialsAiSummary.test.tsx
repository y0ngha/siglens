vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) =>
        args
            .flat()
            .filter(a => typeof a === 'string' && a.length > 0)
            .join(' '),
}));
vi.mock('@/features/symbol-model', () => ({
    useDefaultModelId: () => 'gemini-2.5-flash-lite',
    useAnalysisSettingsHydrated: () => true,
    useDefaultReasoning: () => false,
}));
vi.mock('../hooks/useFinancialsAnalysis', () => ({
    useFinancialsAnalysis: vi.fn(),
}));
vi.mock('@/features/symbol-chat', () => ({
    usePublishSymbolChat: vi.fn(),
}));
vi.mock('../utils/buildChatState', () => ({
    buildChatState: () => ({
        context: { kind: 'financials', payload: { stub: true } },
        timeframe: null,
        isAnalysisReady: true,
    }),
}));
vi.mock('../FinancialsAiSummaryError', () => ({
    FinancialsAiSummaryError: () => <div data-testid="error" />,
}));
vi.mock('../FinancialsAiSummarySkeleton', () => ({
    FinancialsAiSummarySkeleton: () => <div data-testid="skeleton" />,
}));
vi.mock('@/shared/ui/BotBlockedNotice', () => ({
    BotBlockedNotice: () => <div data-testid="bot-blocked" />,
}));

import { render, screen } from '@testing-library/react';

import { FinancialsAiSummary } from '../FinancialsAiSummary';
import { useFinancialsAnalysis } from '../hooks/useFinancialsAnalysis';
import { usePublishSymbolChat } from '@/features/symbol-chat';

describe('FinancialsAiSummary', () => {
    /**
     * 페이지가 SSR 스냅샷 프로즈를 보여줄 때 이 위젯은 `hideView`로 마운트된다.
     * UI는 내지 않지만 챗봇 분석 컨텍스트 publish는 계속돼야 한다 — 위젯을 아예
     * 렌더하지 않던 이전 동작에서는 스냅샷(=완료된 분석)이 있는 종목일수록
     * 챗 입력이 "분석이 완료된 후 질문할 수 있어요"로 잠기는 역전이 있었다.
     */
    describe('hideView', () => {
        it('UI는 렌더하지 않는다', () => {
            vi.mocked(useFinancialsAnalysis).mockReturnValue({
                status: 'loading',
                trigger: vi.fn(),
            });

            const { container } = render(
                <FinancialsAiSummary symbol="AAPL" hideView />
            );

            expect(container).toBeEmptyDOMElement();
            expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
        });

        it('UI를 숨겨도 챗 컨텍스트는 publish한다', () => {
            vi.mocked(useFinancialsAnalysis).mockReturnValue({
                status: 'done',
                result: {} as never,
                trigger: vi.fn(),
            });

            render(<FinancialsAiSummary symbol="AAPL" hideView />);

            expect(vi.mocked(usePublishSymbolChat)).toHaveBeenCalledWith(
                expect.objectContaining({ isAnalysisReady: true })
            );
        });
    });

    it('renders skeleton during loading', () => {
        vi.mocked(useFinancialsAnalysis).mockReturnValue({
            status: 'loading',
            trigger: vi.fn(),
        });

        render(<FinancialsAiSummary symbol="AAPL" />);

        expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    });

    it('renders bot-blocked notice', () => {
        vi.mocked(useFinancialsAnalysis).mockReturnValue({
            status: 'bot_blocked',
            trigger: vi.fn(),
        });

        render(<FinancialsAiSummary symbol="AAPL" />);

        expect(screen.getByTestId('bot-blocked')).toBeInTheDocument();
    });

    it('renders error component on error', () => {
        vi.mocked(useFinancialsAnalysis).mockReturnValue({
            status: 'error',
            error: new Error('test'),
            retry: vi.fn(),
            trigger: vi.fn(),
        });

        render(<FinancialsAiSummary symbol="AAPL" />);

        expect(screen.getByTestId('error')).toBeInTheDocument();
    });

    it('renders overall conclusion and sentiment on success', () => {
        vi.mocked(useFinancialsAnalysis).mockReturnValue({
            status: 'done',
            result: {
                overallSentiment: 'bullish',
                overallConclusionKo: '재무 상태가 우수합니다',
                axisAssessments: [],
                riskFactorsKo: [],
            },
            trigger: vi.fn(),
        });

        render(<FinancialsAiSummary symbol="AAPL" />);

        expect(screen.getByText('재무 상태가 우수합니다')).toBeInTheDocument();
        expect(screen.getByText('긍정')).toBeInTheDocument();
    });

    it('renders all 4 axes with labels and rationale', () => {
        vi.mocked(useFinancialsAnalysis).mockReturnValue({
            status: 'done',
            result: {
                overallSentiment: 'neutral',
                overallConclusionKo: '전반적으로 중립입니다',
                axisAssessments: [
                    {
                        axis: 'growth',
                        sentiment: 'bullish',
                        rationaleKo: '성장성 설명',
                    },
                    {
                        axis: 'quality',
                        sentiment: 'neutral',
                        rationaleKo: '수익성 설명',
                    },
                    {
                        axis: 'solvency',
                        sentiment: 'bearish',
                        rationaleKo: '안정성 설명',
                    },
                    {
                        axis: 'cash',
                        sentiment: 'bullish',
                        rationaleKo: '현금창출력 설명',
                    },
                ],
                riskFactorsKo: [],
            },
            trigger: vi.fn(),
        });

        render(<FinancialsAiSummary symbol="AAPL" />);

        expect(screen.getByText('성장성')).toBeInTheDocument();
        expect(screen.getByText('수익성·질')).toBeInTheDocument();
        expect(screen.getByText('안정성')).toBeInTheDocument();
        expect(screen.getByText('현금창출력')).toBeInTheDocument();
        expect(screen.getByText('성장성 설명')).toBeInTheDocument();
        expect(screen.getByText('수익성 설명')).toBeInTheDocument();
        expect(screen.getByText('안정성 설명')).toBeInTheDocument();
        expect(screen.getByText('현금창출력 설명')).toBeInTheDocument();
    });

    it('renders risk factors bullet list', () => {
        vi.mocked(useFinancialsAnalysis).mockReturnValue({
            status: 'done',
            result: {
                overallSentiment: 'bearish',
                overallConclusionKo: '위험 요인이 있습니다',
                axisAssessments: [],
                riskFactorsKo: ['부채 증가', '현금흐름 악화'],
            },
            trigger: vi.fn(),
        });

        render(<FinancialsAiSummary symbol="AAPL" />);

        expect(screen.getByText('위험 요인')).toBeInTheDocument();
        expect(screen.getByText('부채 증가')).toBeInTheDocument();
        expect(screen.getByText('현금흐름 악화')).toBeInTheDocument();
    });
});
