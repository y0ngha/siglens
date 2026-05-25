import { render, screen } from '@testing-library/react';
import { OptionsAiAnalysis } from '@/widgets/options/OptionsAiAnalysis';
import type { OptionsAnalysisResponse } from '@y0ngha/siglens-core';

const mockState = vi.fn();

vi.mock('@/widgets/options/hooks/useOptionsAnalysis', () => ({
    useOptionsAnalysis: () => mockState(),
}));

vi.mock('@/features/symbol-chat', () => ({
    usePublishSymbolChat: vi.fn(),
}));

vi.mock('@/widgets/options/utils/buildChatState', () => ({
    buildChatState: () => ({
        context: null,
        timeframe: null,
        isAnalysisReady: false,
    }),
}));

vi.mock('@/shared/ui/BotBlockedNotice', () => ({
    BotBlockedNotice: () => <div data-testid="bot-blocked">Bot blocked</div>,
}));

vi.mock('@/widgets/options/OptionsAiAnalysisSkeleton', () => ({
    OptionsAiAnalysisSkeleton: () => <div data-testid="skeleton">Loading</div>,
}));

vi.mock('@/widgets/options/OptionsAiAnalysisError', () => ({
    OptionsAiAnalysisError: () => <div data-testid="error">Error</div>,
}));

vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

vi.mock('@/shared/lib/formatAnalyzedAt', () => ({
    formatAnalyzedAt: (d: string) => d,
}));

const RESULT: OptionsAnalysisResponse = {
    summary: 'Bullish options flow',
    perExpiration: [
        {
            expirationDate: '2025-06-20',
            tone: 'bullish' as const,
            commentary: 'Heavy call buying',
        },
    ],
    signals: [
        {
            kind: 'bullish' as const,
            message: 'Large call sweeps detected',
        },
    ],
    analyzedAt: '2025-01-15T10:00:00Z',
};

describe('OptionsAiAnalysis', () => {
    afterEach(() => {
        mockState.mockReset();
    });

    it('renders skeleton during loading', () => {
        mockState.mockReturnValue({ status: 'loading' });
        render(
            <OptionsAiAnalysis
                symbol="AAPL"
                companyName="Apple"
                expirationDate="2025-06-20"
                modelId={'gemini-2.5-flash-lite' as never}
            />
        );
        expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    });

    it('renders bot blocked notice', () => {
        mockState.mockReturnValue({ status: 'bot_blocked' });
        render(
            <OptionsAiAnalysis
                symbol="AAPL"
                companyName="Apple"
                expirationDate="2025-06-20"
                modelId={'gemini-2.5-flash-lite' as never}
            />
        );
        expect(screen.getByTestId('bot-blocked')).toBeInTheDocument();
    });

    it('renders error state', () => {
        mockState.mockReturnValue({
            status: 'error',
            error: new Error('fail'),
            retry: vi.fn(),
        });
        render(
            <OptionsAiAnalysis
                symbol="AAPL"
                companyName="Apple"
                expirationDate="2025-06-20"
                modelId={'gemini-2.5-flash-lite' as never}
            />
        );
        expect(screen.getByTestId('error')).toBeInTheDocument();
    });

    it('renders analysis result with summary and signals', () => {
        mockState.mockReturnValue({ status: 'done', result: RESULT });
        render(
            <OptionsAiAnalysis
                symbol="AAPL"
                companyName="Apple"
                expirationDate="2025-06-20"
                modelId={'gemini-2.5-flash-lite' as never}
            />
        );
        expect(screen.getByText('Bullish options flow')).toBeInTheDocument();
        expect(screen.getByText('Heavy call buying')).toBeInTheDocument();
        expect(
            screen.getByText('Large call sweeps detected')
        ).toBeInTheDocument();
    });
});
