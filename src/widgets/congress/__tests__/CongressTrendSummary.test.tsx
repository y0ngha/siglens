// vi.mock → imports 순서 (MISTAKES.md Tests §17)
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
vi.mock('../hooks/useCongressTrend', () => ({
    useCongressTrend: vi.fn(),
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

import { ShareableAnalysisProvider, useShareable } from '@/features/share';
import { CongressTrendSummary } from '../CongressTrendSummary';
import { useCongressTrend } from '../hooks/useCongressTrend';

describe('CongressTrendSummary', () => {
    /**
     * 페이지가 SSR 스냅샷 프로즈를 보여줄 때 이 위젯은 `hideView`로 마운트된다.
     * UI는 없지만 `useRegisterShareable`은 계속 돌아야 한다 — 위젯을 아예
     * 렌더하지 않으면 헤더 공유 버튼이 이 탭의 분석 결과를 등록받지 못한다
     * (review round 2 fix).
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

        it('UI를 숨겨도 공유 데이터 등록은 계속된다', () => {
            vi.mocked(useCongressTrend).mockReturnValue({
                status: 'done',
                plain: null,
                result: {} as never,
                trigger: vi.fn(),
            } as never);

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
                    <CongressTrendSummary symbol="AAPL" hideView />
                    <Probe />
                </ShareableAnalysisProvider>
            );

            expect(screen.getByTestId('probe').textContent).toBe('congress');
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
});
