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
vi.mock('../FundamentalAiSummaryError', () => ({
    FundamentalAiSummaryError: () => <div data-testid="error" />,
}));
vi.mock('../FundamentalAiSummarySkeleton', () => ({
    FundamentalAiSummarySkeleton: () => <div data-testid="skeleton" />,
}));
vi.mock('@/shared/ui/BotBlockedNotice', () => ({
    BotBlockedNotice: () => <div data-testid="bot-blocked" />,
}));

import { render, screen } from '@testing-library/react';

import { ShareableAnalysisProvider, useShareable } from '@/features/share';
import { FundamentalAiSummary } from '../FundamentalAiSummary';
import { useFundamentalAnalysis } from '../hooks/useFundamentalAnalysis';

describe('FundamentalAiSummary', () => {
    /**
     * 페이지가 SSR 스냅샷 프로즈를 보여줄 때 이 위젯은 `hideView`로 마운트된다.
     * UI는 내지 않지만 `useRegisterShareable`은 계속 돌아야 한다 — 위젯을 아예
     * 렌더하지 않으면 헤더 공유 버튼이 이 탭의 분석 결과를 등록받지 못한다
     * (review round 2 fix).
     */
    describe('hideView', () => {
        it('UI는 렌더하지 않는다', () => {
            vi.mocked(useFundamentalAnalysis).mockReturnValue({
                status: 'loading',
                trigger: vi.fn(),
            });

            const { container } = render(
                <FundamentalAiSummary symbol="AAPL" hideView />
            );

            expect(container).toBeEmptyDOMElement();
            expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
        });

        it('UI를 숨겨도 공유 데이터 등록은 계속된다', () => {
            vi.mocked(useFundamentalAnalysis).mockReturnValue({
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
                    <FundamentalAiSummary symbol="AAPL" hideView />
                    <Probe />
                </ShareableAnalysisProvider>
            );

            expect(screen.getByTestId('probe').textContent).toBe('fundamental');
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
});
