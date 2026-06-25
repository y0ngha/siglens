// vi.mock → imports 순서 (MISTAKES.md Tests §17)
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
vi.mock('../hooks/useCongressTrend', () => ({
    useCongressTrend: vi.fn(),
}));
vi.mock('@/features/symbol-chat', () => ({
    usePublishSymbolChat: vi.fn(),
}));
vi.mock('../utils/buildChatState', () => ({
    buildChatState: () => null,
}));
vi.mock('../CongressTrendSummaryError', () => ({
    CongressTrendSummaryError: () => <div data-testid="error" />,
}));
vi.mock('../CongressTrendSummarySkeleton', () => ({
    CongressTrendSummarySkeleton: () => <div data-testid="skeleton" />,
}));
vi.mock('../CongressTrendSummaryEmpty', () => ({
    CongressTrendSummaryEmpty: () => <div data-testid="empty" />,
}));
vi.mock('@/shared/ui/BotBlockedNotice', () => ({
    BotBlockedNotice: () => <div data-testid="bot-blocked" />,
}));

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { CongressTrendSummary } from '../CongressTrendSummary';
import { useCongressTrend } from '../hooks/useCongressTrend';

describe('CongressTrendSummary', () => {
    it('renders skeleton during loading', () => {
        vi.mocked(useCongressTrend).mockReturnValue({
            status: 'loading',
        });

        render(<CongressTrendSummary symbol="AAPL" />);

        expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    });

    it('renders empty state when no trades exist', () => {
        vi.mocked(useCongressTrend).mockReturnValue({
            status: 'no_trades',
        });

        render(<CongressTrendSummary symbol="AAPL" />);

        expect(screen.getByTestId('empty')).toBeInTheDocument();
    });

    it('renders bot-blocked notice', () => {
        vi.mocked(useCongressTrend).mockReturnValue({
            status: 'bot_blocked',
        });

        render(<CongressTrendSummary symbol="AAPL" />);

        expect(screen.getByTestId('bot-blocked')).toBeInTheDocument();
    });

    it('renders error component on error', () => {
        vi.mocked(useCongressTrend).mockReturnValue({
            status: 'error',
            error: new Error('test'),
            retry: vi.fn(),
        });

        render(<CongressTrendSummary symbol="AAPL" />);

        expect(screen.getByTestId('error')).toBeInTheDocument();
    });

    it('renders view with result on success', () => {
        vi.mocked(useCongressTrend).mockReturnValue({
            status: 'done',
            result: {
                overallSentiment: 'bullish',
                summaryKo: '의회 매수 동향이 강하게 나타납니다.',
                notableMembersKo: [],
                riskNoteKo: '',
            },
        });

        render(<CongressTrendSummary symbol="AAPL" />);

        // CongressTrendSummaryView is NOT mocked — its real render is exercised.
        expect(
            screen.getByText('의회 매수 동향이 강하게 나타납니다.')
        ).toBeInTheDocument();
        expect(screen.getByText('매수 우위')).toBeInTheDocument();
    });

    it('publishes chat state via usePublishSymbolChat on every render', async () => {
        const { usePublishSymbolChat } = await import('@/features/symbol-chat');
        vi.mocked(useCongressTrend).mockReturnValue({
            status: 'loading',
        });

        render(<CongressTrendSummary symbol="AAPL" />);

        // The hook must be called regardless of the status branch so the chatbot
        // does not carry stale context from a previous page (mirrors FinancialsAiSummary).
        // buildChatState is mocked to return null, so the call must carry null context
        // (non-done states publish null to clear stale analysis).
        expect(vi.mocked(usePublishSymbolChat)).toHaveBeenCalledWith(null);
    });
});
