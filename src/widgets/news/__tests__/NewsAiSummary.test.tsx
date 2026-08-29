import { render, screen } from '@testing-library/react';
import { usePublishSymbolChat } from '@/features/symbol-chat';
import { NewsAiSummary } from '@/widgets/news/NewsAiSummary';
import type { NewsAnalysisResponse } from '@y0ngha/siglens-core';

const ensureNewsCardsAnalyzedActionSpy = vi.hoisted(() =>
    vi.fn().mockResolvedValue(undefined)
);
const mockWaitResult = vi.fn();
const mockAnalysisResult = vi.fn();

vi.mock('@/entities/news-article/actions', () => ({
    ensureNewsCardsAnalyzedAction: ensureNewsCardsAnalyzedActionSpy,
}));

vi.mock('@/widgets/news/hooks/useWaitForNewsCards', () => ({
    useWaitForNewsCards: () => mockWaitResult(),
}));

vi.mock('@/widgets/news/hooks/useNewsAnalysis', () => ({
    useNewsAnalysis: () => mockAnalysisResult(),
}));

vi.mock('@/features/symbol-chat', () => ({
    usePublishSymbolChat: vi.fn(),
}));

vi.mock('@/widgets/news/utils/buildChatState', () => ({
    buildChatState: () => ({
        context: null,
        timeframe: null,
        isAnalysisReady: false,
    }),
}));

vi.mock('@/shared/ui/BotBlockedNotice', () => ({
    BotBlockedNotice: () => <div data-testid="bot-blocked" />,
}));

vi.mock('@/features/symbol-model', () => ({
    useDefaultModelId: () => 'gemini-2.5-flash-lite',
    useAnalysisSettingsHydrated: () => true,
    useDefaultReasoning: () => false,
}));

vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

// 상수는 이제 표시 문자열이 아니라 `shared.lib.newsPeriod` 키다.
vi.mock('@/shared/lib/news/periodLabels', () => ({
    NEWS_ANALYSIS_PERIOD_KEY: 'last30Days',
}));

const RESULT: NewsAnalysisResponse = {
    overallSentiment: 'bullish' as const,
    currentDriverKo: 'Strong earnings',
    keyEventsKo: ['Earnings beat'],
    upcomingEventsKo: ['Fed meeting'],
};

describe('NewsAiSummary', () => {
    afterEach(() => {
        mockWaitResult.mockReset();
        mockAnalysisResult.mockReset();
    });

    /**
     * 스냅샷 프로즈가 보이는 동안에도 위젯은 마운트된 채 `hideView`로 UI만 끈다.
     * 언마운트하면 `usePublishSymbolChat`이 돌지 않아 챗 입력이 잠긴다.
     */
    describe('hideView', () => {
        it('UI를 렌더하지 않는다', () => {
            mockWaitResult.mockReturnValue({ isReady: true, pollError: null });
            mockAnalysisResult.mockReturnValue({
                status: 'done',
                result: RESULT,
                trigger: vi.fn(),
            });

            const { container } = render(
                <NewsAiSummary
                    symbol="AAPL"
                    companyName="Apple"
                    hasEnrichedNews
                    hideView
                />
            );

            expect(container).toBeEmptyDOMElement();
        });

        it('UI를 숨겨도 챗 컨텍스트 publish는 계속된다', () => {
            mockWaitResult.mockReturnValue({ isReady: true, pollError: null });
            mockAnalysisResult.mockReturnValue({
                status: 'done',
                result: RESULT,
                trigger: vi.fn(),
            });

            render(
                <NewsAiSummary
                    symbol="AAPL"
                    companyName="Apple"
                    hasEnrichedNews
                    hideView
                />
            );

            expect(vi.mocked(usePublishSymbolChat)).toHaveBeenCalled();
        });

        /** pollError는 hideView와 무관하게 에러 바운더리로 전파돼야 한다. */
        it('hideView여도 pollError는 전파한다', () => {
            mockWaitResult.mockReturnValue({
                isReady: false,
                pollError: new Error('poll failed'),
            });
            mockAnalysisResult.mockReturnValue({
                status: 'loading',
                trigger: vi.fn(),
            });

            expect(() =>
                render(
                    <NewsAiSummary
                        symbol="AAPL"
                        companyName="Apple"
                        hasEnrichedNews
                        hideView
                    />
                )
            ).toThrow('poll failed');
        });
    });

    it('renders fetching phase while waiting for cards', () => {
        mockWaitResult.mockReturnValue({
            isReady: false,
            pollError: null,
        });
        mockAnalysisResult.mockReturnValue({
            status: 'loading',
            trigger: vi.fn(),
        });

        render(
            <NewsAiSummary
                symbol="AAPL"
                companyName="Apple"
                hasEnrichedNews={false}
            />
        );
        expect(
            screen.getByText(/뉴스 데이터를 수집하고 있어요/)
        ).toBeInTheDocument();
    });

    it('renders analyzing phase when cards ready but analysis loading', () => {
        mockWaitResult.mockReturnValue({
            isReady: true,
            pollError: null,
        });
        mockAnalysisResult.mockReturnValue({
            status: 'loading',
            trigger: vi.fn(),
        });

        render(
            <NewsAiSummary
                symbol="AAPL"
                companyName="Apple"
                hasEnrichedNews={true}
            />
        );
        expect(screen.getByText(/AI 종합 분석 중이에요/)).toBeInTheDocument();
    });

    it('renders result view when analysis is done', () => {
        mockWaitResult.mockReturnValue({
            isReady: true,
            pollError: null,
        });
        mockAnalysisResult.mockReturnValue({
            status: 'done',
            result: RESULT,
            trigger: vi.fn(),
        });

        render(
            <NewsAiSummary
                symbol="AAPL"
                companyName="Apple"
                hasEnrichedNews={true}
            />
        );
        expect(screen.getByText('Strong earnings')).toBeInTheDocument();
        expect(screen.getByText('Earnings beat')).toBeInTheDocument();
        expect(screen.getByText('Fed meeting')).toBeInTheDocument();
    });

    it('renders bot blocked notice', () => {
        mockWaitResult.mockReturnValue({
            isReady: true,
            pollError: null,
        });
        mockAnalysisResult.mockReturnValue({
            status: 'bot_blocked',
            trigger: vi.fn(),
        });

        render(
            <NewsAiSummary
                symbol="AAPL"
                companyName="Apple"
                hasEnrichedNews={true}
            />
        );
        expect(screen.getByTestId('bot-blocked')).toBeInTheDocument();
    });

    it('renders error state with retry', () => {
        mockWaitResult.mockReturnValue({
            isReady: true,
            pollError: null,
        });
        mockAnalysisResult.mockReturnValue({
            status: 'error',
            error: new Error('Analysis failed'),
            retry: vi.fn(),
            trigger: vi.fn(),
        });

        render(
            <NewsAiSummary
                symbol="AAPL"
                companyName="Apple"
                hasEnrichedNews={true}
            />
        );
        expect(screen.getByText('Analysis failed')).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /다시 시도/ })
        ).toBeInTheDocument();
    });

    it('throws pollError for error boundary to catch', () => {
        mockWaitResult.mockReturnValue({
            isReady: false,
            pollError: new Error('Poll failure'),
        });
        mockAnalysisResult.mockReturnValue({
            status: 'loading',
            trigger: vi.fn(),
        });

        expect(() =>
            render(
                <NewsAiSummary
                    symbol="AAPL"
                    companyName="Apple"
                    hasEnrichedNews={false}
                />
            )
        ).toThrow('Poll failure');
    });
});

describe('NewsAiSummary mount trigger', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockWaitResult.mockReturnValue({ isReady: false, pollError: null });
        mockAnalysisResult.mockReturnValue({
            status: 'loading',
            trigger: vi.fn(),
        });
    });

    it('마운트 시 ensureNewsCardsAnalyzedAction을 symbol로 1회 호출한다', () => {
        render(
            <NewsAiSummary
                symbol="AAPL"
                companyName="Apple"
                hasEnrichedNews={false}
            />
        );
        expect(ensureNewsCardsAnalyzedActionSpy).toHaveBeenCalledWith('AAPL');
        expect(ensureNewsCardsAnalyzedActionSpy).toHaveBeenCalledTimes(1);
    });
});
