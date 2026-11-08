const actions = vi.hoisted(() => ({ submit: vi.fn() }));
vi.mock('@/entities/feedback/actions/submitVocFeedbackAction', () => ({
    submitVocFeedbackAction: actions.submit,
}));

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { VocTrigger } from '@/entities/feedback/types';
import { VocPromptModal } from '../ui/VocPromptModal';

const stars = () => screen.getAllByRole('radio');
const submitButton = () => screen.getByRole('button', { name: '보내기' });

function renderModal(trigger: VocTrigger = 'analysis') {
    const onClose = vi.fn();
    render(<VocPromptModal trigger={trigger} onClose={onClose} />);
    return { onClose };
}

describe('VocPromptModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        actions.submit.mockResolvedValue({ ok: true });
    });
    afterEach(() => vi.useRealTimers());

    it('제목·안내·별 5개·의견칸을 보여 준다', () => {
        renderModal();

        expect(
            screen.getByRole('dialog', { name: '시그렌즈, 써 보니 어떠세요?' })
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                '별점과 한 줄 의견을 남겨 주시면 서비스 개선에 바로 반영할게요.'
            )
        ).toBeInTheDocument();
        expect(
            screen.getByRole('radiogroup', { name: '별점' })
        ).toBeInTheDocument();
        expect(stars().map(s => s.getAttribute('aria-label'))).toEqual([
            '1점',
            '2점',
            '3점',
            '4점',
            '5점',
        ]);
        expect(
            screen.getByPlaceholderText(
                '좋았던 점이나 아쉬운 점을 자유롭게 적어 주세요 (선택)'
            )
        ).toBeInTheDocument();
    });

    it('별을 고르기 전에는 보내기가 막혀 있다', () => {
        renderModal();

        expect(submitButton()).toBeDisabled();
        expect(
            stars().every(s => s.getAttribute('aria-checked') === 'false')
        ).toBe(true);
    });

    it('별을 누르면 그 별만 선택되고 보내기가 열린다', async () => {
        const user = userEvent.setup();
        renderModal();

        await user.click(screen.getByRole('radio', { name: '4점' }));

        expect(screen.getByRole('radio', { name: '4점' })).toHaveAttribute(
            'aria-checked',
            'true'
        );
        expect(screen.getByRole('radio', { name: '5점' })).toHaveAttribute(
            'aria-checked',
            'false'
        );
        expect(submitButton()).toBeEnabled();
    });

    it('hover한 별까지 미리 채워 보이되 선택값은 그대로다', async () => {
        const user = userEvent.setup();
        renderModal();
        await user.click(screen.getByRole('radio', { name: '2점' }));

        const filled = () =>
            stars().map(s => s.querySelector('svg')?.getAttribute('fill'));
        expect(filled()).toEqual([
            'currentColor',
            'currentColor',
            'none',
            'none',
            'none',
        ]);

        await user.hover(screen.getByRole('radio', { name: '5점' }));
        expect(filled().every(f => f === 'currentColor')).toBe(true);
        expect(screen.getByRole('radio', { name: '2점' })).toHaveAttribute(
            'aria-checked',
            'true'
        );

        await user.unhover(screen.getByRole('radio', { name: '5점' }));
        expect(filled()).toEqual([
            'currentColor',
            'currentColor',
            'none',
            'none',
            'none',
        ]);
    });

    describe('키보드', () => {
        it('Tab으로는 그룹에 한 번만 들어가고, 고른 뒤에는 고른 별에 머문다', async () => {
            const user = userEvent.setup();
            renderModal();

            expect(stars().map(s => s.getAttribute('tabindex'))).toEqual([
                '0',
                '-1',
                '-1',
                '-1',
                '-1',
            ]);

            await user.click(screen.getByRole('radio', { name: '3점' }));

            expect(stars().map(s => s.getAttribute('tabindex'))).toEqual([
                '-1',
                '-1',
                '0',
                '-1',
                '-1',
            ]);
        });

        it('오른쪽·위 화살표는 다음 별을 선택하고 포커스를 옮긴다', async () => {
            const user = userEvent.setup();
            renderModal();
            stars()[0]!.focus();

            await user.keyboard('{ArrowRight}');
            expect(screen.getByRole('radio', { name: '2점' })).toHaveAttribute(
                'aria-checked',
                'true'
            );
            expect(document.activeElement).toBe(stars()[1]);

            await user.keyboard('{ArrowUp}');
            expect(document.activeElement).toBe(stars()[2]);
        });

        it('왼쪽·아래 화살표는 이전 별로 가고 양 끝에서 멈춘다', async () => {
            const user = userEvent.setup();
            renderModal();
            await user.click(screen.getByRole('radio', { name: '2점' }));

            await user.keyboard('{ArrowLeft}');
            expect(document.activeElement).toBe(stars()[0]);
            await user.keyboard('{ArrowDown}');
            expect(screen.getByRole('radio', { name: '1점' })).toHaveAttribute(
                'aria-checked',
                'true'
            );

            await user.click(screen.getByRole('radio', { name: '5점' }));
            await user.keyboard('{ArrowRight}');
            expect(screen.getByRole('radio', { name: '5점' })).toHaveAttribute(
                'aria-checked',
                'true'
            );
        });

        it('Home·End는 첫 별과 마지막 별을 고른다', async () => {
            const user = userEvent.setup();
            renderModal();
            stars()[0]!.focus();

            await user.keyboard('{End}');
            expect(screen.getByRole('radio', { name: '5점' })).toHaveAttribute(
                'aria-checked',
                'true'
            );
            await user.keyboard('{Home}');
            expect(screen.getByRole('radio', { name: '1점' })).toHaveAttribute(
                'aria-checked',
                'true'
            );
        });
    });

    describe('의견', () => {
        it('글자 수를 세고 최대 길이를 넘기지 못한다', async () => {
            const user = userEvent.setup();
            renderModal();
            const textarea = screen.getByLabelText('의견');

            expect(textarea).toHaveAttribute('maxlength', '1000');
            expect(screen.getByText('0/1000')).toBeInTheDocument();

            await user.type(textarea, '좋아요');
            expect(screen.getByText('3/1000')).toBeInTheDocument();
        });
    });

    describe('보내기', () => {
        it('siglens.io 계기는 siglens 표면으로, 별점·다듬은 의견·경로와 함께 보낸다', async () => {
            const user = userEvent.setup();
            renderModal('analysis');
            await user.click(screen.getByRole('radio', { name: '5점' }));
            await user.type(
                screen.getByLabelText('의견'),
                '  차트가 보기 편해요  '
            );

            await user.click(submitButton());

            expect(actions.submit).toHaveBeenCalledTimes(1);
            expect(actions.submit).toHaveBeenCalledWith({
                surface: 'siglens',
                rating: 5,
                comment: '차트가 보기 편해요',
                trigger: 'analysis',
                pagePath: window.location.pathname,
            });
        });

        it('시그렌즈 AI 계기는 siglens_ai 표면이고, 의견이 비면 comment 키가 없다', async () => {
            const user = userEvent.setup();
            renderModal('agent_chat');
            await user.click(screen.getByRole('radio', { name: '3점' }));

            await user.click(submitButton());

            expect(actions.submit).toHaveBeenCalledWith({
                surface: 'siglens_ai',
                rating: 3,
                trigger: 'agent_chat',
                pagePath: window.location.pathname,
            });
        });

        it('보내는 동안 중복으로 보내지 않는다', async () => {
            let resolve: (v: { ok: true }) => void = () => {};
            actions.submit.mockReturnValue(
                new Promise(r => {
                    resolve = r;
                })
            );
            const user = userEvent.setup();
            renderModal();
            await user.click(screen.getByRole('radio', { name: '4점' }));

            await user.click(submitButton());
            expect(submitButton()).toBeDisabled();
            await user.click(submitButton());

            expect(actions.submit).toHaveBeenCalledTimes(1);
            await act(async () => resolve({ ok: true }));
        });

        it('성공하면 감사 문구를 보이고 잠시 뒤 닫는다', async () => {
            vi.useFakeTimers({ shouldAdvanceTime: true });
            const user = userEvent.setup({
                advanceTimers: vi.advanceTimersByTime,
            });
            const { onClose } = renderModal();
            await user.click(screen.getByRole('radio', { name: '5점' }));

            await user.click(submitButton());

            expect(await screen.findByRole('status')).toHaveTextContent(
                '의견 고마워요'
            );
            expect(onClose).not.toHaveBeenCalled();

            await act(async () => {
                vi.advanceTimersByTime(2000);
            });

            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('실패하면 모달을 유지하고 오류를 알린 뒤 같은 입력으로 다시 보낼 수 있다', async () => {
            actions.submit
                .mockResolvedValueOnce({ ok: false, code: 'rate_limited' })
                .mockResolvedValueOnce({ ok: true });
            const user = userEvent.setup();
            const { onClose } = renderModal();
            await user.click(screen.getByRole('radio', { name: '2점' }));
            await user.type(screen.getByLabelText('의견'), '아쉬워요');

            await user.click(submitButton());

            expect(await screen.findByRole('alert')).toHaveTextContent(
                '의견을 보내지 못했어요. 잠시 후 다시 시도해 주세요.'
            );
            expect(onClose).not.toHaveBeenCalled();
            expect(screen.getByLabelText('의견')).toHaveValue('아쉬워요');

            await user.click(submitButton());

            await waitFor(() =>
                expect(screen.getByRole('status')).toHaveTextContent(
                    '의견 고마워요'
                )
            );
            expect(actions.submit).toHaveBeenCalledTimes(2);
            expect(actions.submit).toHaveBeenLastCalledWith(
                expect.objectContaining({ rating: 2, comment: '아쉬워요' })
            );
        });

        it('액션이 던져도 같은 오류 상태가 된다', async () => {
            actions.submit.mockRejectedValue(new Error('network'));
            const user = userEvent.setup();
            renderModal();
            await user.click(screen.getByRole('radio', { name: '2점' }));

            await user.click(submitButton());

            expect(await screen.findByRole('alert')).toHaveTextContent(
                '의견을 보내지 못했어요'
            );
        });
    });

    describe('닫기', () => {
        it('닫기 버튼은 보내지 않고 닫는다', async () => {
            const user = userEvent.setup();
            const { onClose } = renderModal();

            await user.click(screen.getByRole('button', { name: '닫기' }));

            expect(onClose).toHaveBeenCalledTimes(1);
            expect(actions.submit).not.toHaveBeenCalled();
        });

        it('Esc로도 닫힌다', async () => {
            const user = userEvent.setup();
            const { onClose } = renderModal();

            await user.keyboard('{Escape}');

            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });
});
