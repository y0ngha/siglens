// vi.mock → imports 순서 (MISTAKES.md Tests §17)
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

import { usePublishSymbolChat } from '@/features/symbol-chat';
import { CongressTrendSummary } from '../CongressTrendSummary';
import { useCongressTrend } from '../hooks/useCongressTrend';

describe('CongressTrendSummary', () => {
    /**
     * 페이지가 SSR 스냅샷 프로즈를 보여줄 때 이 위젯은 `hideView`로 마운트된다.
     * UI는 없지만 챗봇 분석 컨텍스트 publish는 계속돼야 한다 — 위젯을 아예
     * 렌더하지 않던 이전 동작에서는 완료된 분석이 있는 종목일수록 챗 입력이
     * "분석이 완료된 후 질문할 수 있어요"로 잠기는 역전이 있었다.
     */
    describe('hideView', () => {
        it('UI를 렌더하지 않는다', () => {
            vi.mocked(useCongressTrend).mockReturnValue({
                status: 'loading',
                trigger: vi.fn(),
            } as never);

            const { container } = render(
                <CongressTrendSummary symbol="AAPL" hideView />
            );

            expect(container).toBeEmptyDOMElement();
        });

        it('UI를 숨겨도 챗 컨텍스트 publish는 계속된다', () => {
            vi.mocked(useCongressTrend).mockReturnValue({
                status: 'done',
                plain: null,
                result: {} as never,
                trigger: vi.fn(),
            } as never);

            render(<CongressTrendSummary symbol="AAPL" hideView />);

            expect(vi.mocked(usePublishSymbolChat)).toHaveBeenCalled();
        });
    });

    it('renders skeleton during loading', () => {
        vi.mocked(useCongressTrend).mockReturnValue({
            status: 'loading',
            trigger: vi.fn(),
        });

        render(<CongressTrendSummary symbol="AAPL" />);

        expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    });

    it('renders empty state when no trades exist', () => {
        vi.mocked(useCongressTrend).mockReturnValue({
            status: 'no_trades',
            trigger: vi.fn(),
        });

        render(<CongressTrendSummary symbol="AAPL" />);

        expect(screen.getByTestId('empty')).toBeInTheDocument();
    });

    it('renders bot-blocked notice', () => {
        vi.mocked(useCongressTrend).mockReturnValue({
            status: 'bot_blocked',
            trigger: vi.fn(),
        });

        render(<CongressTrendSummary symbol="AAPL" />);

        expect(screen.getByTestId('bot-blocked')).toBeInTheDocument();
    });

    it('renders error component on error', () => {
        vi.mocked(useCongressTrend).mockReturnValue({
            status: 'error',
            error: new Error('test'),
            retry: vi.fn(),
            trigger: vi.fn(),
        });

        render(<CongressTrendSummary symbol="AAPL" />);

        expect(screen.getByTestId('error')).toBeInTheDocument();
    });

    it('renders view with result on success', () => {
        vi.mocked(useCongressTrend).mockReturnValue({
            status: 'done',
            plain: null,
            result: {
                overallSentiment: 'bullish',
                summaryKo: '의회 매수 동향이 강하게 나타납니다.',
                notableMembersKo: [],
                riskNoteKo: '',
            },
            trigger: vi.fn(),
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
            trigger: vi.fn(),
        });

        render(<CongressTrendSummary symbol="AAPL" />);

        // The hook must be called regardless of the status branch so the chatbot
        // does not carry stale context from a previous page (mirrors FinancialsAiSummary).
        // buildChatState is mocked to return null, so the call must carry null context
        // (non-done states publish null to clear stale analysis).
        expect(vi.mocked(usePublishSymbolChat)).toHaveBeenCalledWith(null);
    });
});
