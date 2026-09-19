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
vi.mock('../hooks/useFinancialsAnalysis', () => ({
    useFinancialsAnalysis: vi.fn(),
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

import { ShareableAnalysisProvider, useShareable } from '@/features/share';
import { FinancialsAiSummary } from '../FinancialsAiSummary';
import { useFinancialsAnalysis } from '../hooks/useFinancialsAnalysis';

describe('FinancialsAiSummary', () => {
    /**
     * 페이지가 SSR 스냅샷 프로즈를 보여줄 때 이 위젯은 `hideView`로 마운트된다.
     * UI는 내지 않지만 `useRegisterShareable`은 계속 돌아야 한다 — 위젯을 아예
     * 렌더하지 않으면 헤더 공유 버튼이 이 탭의 분석 결과를 등록받지 못한다
     * (review round 2 fix).
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

        it('UI를 숨겨도 공유 데이터 등록은 계속된다', () => {
            vi.mocked(useFinancialsAnalysis).mockReturnValue({
                status: 'done',
                plain: null,
                result: {} as never,
                trigger: vi.fn(),
            });

            function Probe() {
                const reg = useShareable();
                return (
                    <div data-testid="probe">
                        {reg === null ? 'NULL' : reg.kind}
                    </div>
                );
            }

            render(
                <ShareableAnalysisProvider>
                    <FinancialsAiSummary symbol="AAPL" hideView />
                    <Probe />
                </ShareableAnalysisProvider>
            );

            expect(screen.getByTestId('probe').textContent).toBe('financials');
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
            plain: null,
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
            plain: null,
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
            plain: null,
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
