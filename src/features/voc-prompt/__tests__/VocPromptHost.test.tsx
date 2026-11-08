vi.mock('@/entities/feedback/actions/submitVocFeedbackAction', () => ({
    submitVocFeedbackAction: vi.fn(),
}));

import { act, render, screen } from '@testing-library/react';
import { publishAgentTurnCompleted } from '@/shared/lib/agentTurnCompletedSignal';
import {
    LOCAL_STORAGE_VOC_PROMPTED_KEY,
    SESSION_STORAGE_NUDGE_SHOWN_KEY,
} from '@/shared/lib/storageKeys';
import { hasNudgeShownThisSession } from '@/shared/lib/nudgeSession';
import {
    publishSymbolAnalyzed,
    subscribeSymbolAnalyzed,
} from '@/shared/lib/symbolAnalyzedSignal';
import { VOC_PROMPT_DELAY_MS, VocPromptHost } from '../ui/VocPromptHost';

const dialog = () => screen.queryByRole('dialog');

function advance(ms: number) {
    act(() => {
        vi.advanceTimersByTime(ms);
    });
}

describe('VocPromptHost', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
        localStorage.clear();
        sessionStorage.clear();
    });

    describe('siglens.io (analysis)', () => {
        it('신호 전에는 아무것도 그리지 않는다', () => {
            render(<VocPromptHost trigger="analysis" />);

            advance(VOC_PROMPT_DELAY_MS * 2);

            expect(dialog()).not.toBeInTheDocument();
        });

        it('첫 분석 신호 뒤 2.5초가 지나야 열린다', () => {
            render(<VocPromptHost trigger="analysis" />);

            act(() => publishSymbolAnalyzed('NVDA'));
            advance(VOC_PROMPT_DELAY_MS - 1);
            expect(dialog()).not.toBeInTheDocument();

            advance(1);
            expect(dialog()).toBeInTheDocument();
        });

        it('신호를 받은 즉시 영구 기록과 세션 넛지 플래그를 함께 남긴다', () => {
            render(<VocPromptHost trigger="analysis" />);

            act(() => publishSymbolAnalyzed('NVDA'));
            expect(dialog()).not.toBeInTheDocument();
            advance(VOC_PROMPT_DELAY_MS);

            expect(localStorage.getItem(LOCAL_STORAGE_VOC_PROMPTED_KEY)).toBe(
                '1'
            );
            expect(
                sessionStorage.getItem(SESSION_STORAGE_NUDGE_SHOWN_KEY)
            ).toBe('1');
        });

        it('여러 번 분석돼도 한 번만 열리고, 닫으면 다시 열리지 않는다', () => {
            render(<VocPromptHost trigger="analysis" />);

            act(() => publishSymbolAnalyzed('NVDA'));
            act(() => publishSymbolAnalyzed('AAPL'));
            advance(VOC_PROMPT_DELAY_MS);
            expect(screen.getAllByRole('dialog')).toHaveLength(1);

            act(() => {
                screen.getByRole('button', { name: '닫기' }).click();
            });
            expect(dialog()).not.toBeInTheDocument();

            act(() => publishSymbolAnalyzed('TSLA'));
            advance(VOC_PROMPT_DELAY_MS * 2);
            expect(dialog()).not.toBeInTheDocument();
        });

        it('이미 띄운 적이 있으면 신호가 와도 열지 않는다', () => {
            localStorage.setItem(LOCAL_STORAGE_VOC_PROMPTED_KEY, '1');
            render(<VocPromptHost trigger="analysis" />);

            act(() => publishSymbolAnalyzed('NVDA'));
            advance(VOC_PROMPT_DELAY_MS * 2);

            expect(dialog()).not.toBeInTheDocument();
        });

        it('이 탭 세션에 다른 넛지가 떴으면 열지 않고, 영구 기록도 남기지 않는다', () => {
            sessionStorage.setItem(SESSION_STORAGE_NUDGE_SHOWN_KEY, '1');
            render(<VocPromptHost trigger="analysis" />);

            act(() => publishSymbolAnalyzed('NVDA'));
            advance(VOC_PROMPT_DELAY_MS * 2);

            expect(dialog()).not.toBeInTheDocument();
            // 다음 방문에서 다시 시도할 수 있어야 한다.
            expect(
                localStorage.getItem(LOCAL_STORAGE_VOC_PROMPTED_KEY)
            ).toBeNull();
        });

        it('지연 중에는 이미 세션을 선점해 뒤따르는 구독자가 같은 신호에 양보한다', () => {
            render(<VocPromptHost trigger="analysis" />);
            let seenByOthers = false;
            const unsubscribe = subscribeSymbolAnalyzed(() => {
                seenByOthers = hasNudgeShownThisSession();
            });

            act(() => publishSymbolAnalyzed('NVDA'));
            unsubscribe();

            expect(seenByOthers).toBe(true);
            advance(VOC_PROMPT_DELAY_MS);
            expect(dialog()).toBeInTheDocument();
        });

        it('2.5초 안에 떠나면(언마운트) 열리지 않는다', () => {
            const { unmount } = render(<VocPromptHost trigger="analysis" />);

            act(() => publishSymbolAnalyzed('NVDA'));
            unmount();
            advance(VOC_PROMPT_DELAY_MS * 2);

            expect(dialog()).not.toBeInTheDocument();
        });

        it('언마운트하면 구독을 해제한다', () => {
            const { unmount } = render(<VocPromptHost trigger="analysis" />);
            unmount();

            act(() => publishSymbolAnalyzed('NVDA'));
            advance(VOC_PROMPT_DELAY_MS * 2);

            expect(dialog()).not.toBeInTheDocument();
        });

        it('시그렌즈 AI 신호에는 반응하지 않는다', () => {
            render(<VocPromptHost trigger="analysis" />);

            act(() => publishAgentTurnCompleted());
            advance(VOC_PROMPT_DELAY_MS * 2);

            expect(dialog()).not.toBeInTheDocument();
        });
    });

    describe('ai.siglens.io (agent_chat)', () => {
        it('첫 답변 턴이 끝나면 2.5초 뒤 열린다', () => {
            render(<VocPromptHost trigger="agent_chat" />);

            act(() => publishAgentTurnCompleted());
            advance(VOC_PROMPT_DELAY_MS);

            expect(dialog()).toBeInTheDocument();
        });

        it('종목 분석 신호에는 반응하지 않는다', () => {
            render(<VocPromptHost trigger="agent_chat" />);

            act(() => publishSymbolAnalyzed('NVDA'));
            advance(VOC_PROMPT_DELAY_MS * 2);

            expect(dialog()).not.toBeInTheDocument();
        });

        it('세션 넛지 플래그를 존중한다', () => {
            sessionStorage.setItem(SESSION_STORAGE_NUDGE_SHOWN_KEY, '1');
            render(<VocPromptHost trigger="agent_chat" />);

            act(() => publishAgentTurnCompleted());
            advance(VOC_PROMPT_DELAY_MS * 2);

            expect(dialog()).not.toBeInTheDocument();
        });
    });
});
