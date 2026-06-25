vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) =>
        args
            .flat()
            .filter(a => typeof a === 'string' && a.length > 0)
            .join(' '),
}));
vi.mock('@/features/symbol-model/hooks/useDefaultModelId', () => ({
    useDefaultModelId: () => 'gemini-2.5-flash-lite',
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

import { render, screen } from '@testing-library/react';

import { FundamentalAiSummary } from '../FundamentalAiSummary';
import { useFundamentalAnalysis } from '../hooks/useFundamentalAnalysis';

describe('FundamentalAiSummary', () => {
    it('renders skeleton during loading', () => {
        vi.mocked(useFundamentalAnalysis).mockReturnValue({
            status: 'loading',
        } as ReturnType<typeof useFundamentalAnalysis>);

        render(<FundamentalAiSummary symbol="AAPL" />);

        expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    });

    it('renders bot-blocked notice', () => {
        vi.mocked(useFundamentalAnalysis).mockReturnValue({
            status: 'bot_blocked',
        } as ReturnType<typeof useFundamentalAnalysis>);

        render(<FundamentalAiSummary symbol="AAPL" />);

        expect(screen.getByTestId('bot-blocked')).toBeInTheDocument();
    });

    it('renders error component on error', () => {
        vi.mocked(useFundamentalAnalysis).mockReturnValue({
            status: 'error',
            error: new Error('test'),
            retry: vi.fn(),
        } as unknown as ReturnType<typeof useFundamentalAnalysis>);

        render(<FundamentalAiSummary symbol="AAPL" />);

        expect(screen.getByTestId('error')).toBeInTheDocument();
    });

    it('renders the analysis result on success', () => {
        vi.mocked(useFundamentalAnalysis).mockReturnValue({
            status: 'done',
            result: {
                overallSentiment: 'bullish',
                overallConclusionKo: '강세 전망입니다',
                categoryAssessments: [],
                riskFactorsKo: [],
            },
        } as unknown as ReturnType<typeof useFundamentalAnalysis>);

        render(<FundamentalAiSummary symbol="AAPL" />);

        expect(screen.getByText('강세 전망입니다')).toBeInTheDocument();
        expect(screen.getByText('긍정')).toBeInTheDocument();
    });
});
