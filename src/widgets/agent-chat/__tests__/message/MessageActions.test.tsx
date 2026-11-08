const actions = vi.hoisted(() => ({ submit: vi.fn(), update: vi.fn() }));
vi.mock('@/entities/feedback/actions/submitAiFeedbackAction', () => ({
    submitAiFeedbackAction: actions.submit,
}));
vi.mock('@/entities/feedback/actions/updateAiFeedbackAction', () => ({
    updateAiFeedbackAction: actions.update,
}));

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AgentMessageFeedbackTarget } from '@/features/ai-feedback/model/targets';
import { MessageActions } from '@/widgets/agent-chat/message/MessageActions';

const TRANSCRIPT = [
    { role: 'user', content: '애플 어때?' },
    { role: 'assistant', content: '상승 추세입니다.' },
] as const;

const FEEDBACK: {
    target: AgentMessageFeedbackTarget;
    resetKey: string;
} = {
    resetKey: 'msg-2',
    target: {
        surface: 'siglens_ai',
        context: { guest: true, messageIndex: 1 },
        getTranscript: () => TRANSCRIPT,
    },
};

describe('MessageActions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        actions.submit.mockResolvedValue({ ok: true, id: 'fb-1' });
        actions.update.mockResolvedValue({ ok: true });
    });

    it('feedback가 없으면 복사만 있고 👍/👎는 없다', () => {
        render(
            <MessageActions align="assistant" copied={false} onCopy={vi.fn()} />
        );

        expect(
            screen.getByRole('button', { name: '복사' })
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: '도움이 됐어요' })
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: '도움이 안 됐어요' })
        ).not.toBeInTheDocument();
    });

    it('feedback가 있으면 복사·다시 생성 옆에 👍/👎가 붙는다', () => {
        render(
            <MessageActions
                align="assistant"
                copied={false}
                onCopy={vi.fn()}
                onRegenerate={vi.fn()}
                feedback={FEEDBACK}
            />
        );

        const names = screen
            .getAllByRole('button')
            .map(
                button =>
                    button.getAttribute('aria-label') ?? button.textContent
            );
        expect(names).toEqual([
            '복사',
            '다시 생성',
            '도움이 됐어요',
            '도움이 안 됐어요',
        ]);
    });

    it('👍/👎는 hover로 드러나는 묶음 밖에 있어 마우스가 벗어나도 사라지지 않는다', () => {
        render(
            <MessageActions
                align="assistant"
                copied={false}
                onCopy={vi.fn()}
                feedback={FEEDBACK}
            />
        );

        const revealed = screen.getByRole('button', { name: '복사' })
            .parentElement as HTMLElement;
        expect(revealed.className).toContain('pointer-fine:opacity-0');
        expect(
            revealed.contains(
                screen.getByRole('button', { name: '도움이 됐어요' })
            )
        ).toBe(false);
        expect(
            screen
                .getByRole('group', { name: '이 답변이 도움이 됐나요?' })
                .closest('[class*="pointer-fine:opacity-0"]')
        ).toBeNull();
    });

    it('👍를 누르면 대화 기록 스냅샷과 함께 저장한다', async () => {
        const user = userEvent.setup();
        render(
            <MessageActions
                align="assistant"
                copied={false}
                onCopy={vi.fn()}
                feedback={FEEDBACK}
            />
        );

        await user.click(screen.getByRole('button', { name: '도움이 됐어요' }));

        await waitFor(() => expect(actions.submit).toHaveBeenCalledTimes(1));
        expect(actions.submit).toHaveBeenCalledWith(
            expect.objectContaining({
                surface: 'siglens_ai',
                vote: 'up',
                snapshot: TRANSCRIPT,
            })
        );
    });

    it('답변이 바뀌면(resetKey) 눌러 둔 평가가 비워진다', async () => {
        const user = userEvent.setup();
        const { rerender } = render(
            <MessageActions
                align="assistant"
                copied={false}
                onCopy={vi.fn()}
                feedback={FEEDBACK}
            />
        );
        await user.click(screen.getByRole('button', { name: '도움이 됐어요' }));
        expect(
            screen.getByRole('button', { name: '도움이 됐어요' })
        ).toHaveAttribute('aria-pressed', 'true');

        rerender(
            <MessageActions
                align="assistant"
                copied={false}
                onCopy={vi.fn()}
                feedback={{ ...FEEDBACK, resetKey: 'msg-3' }}
            />
        );

        expect(
            screen.getByRole('button', { name: '도움이 됐어요' })
        ).toHaveAttribute('aria-pressed', 'false');
    });
});
