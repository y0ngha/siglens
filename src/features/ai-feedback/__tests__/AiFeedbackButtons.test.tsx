const actions = vi.hoisted(() => ({
    submit: vi.fn(),
    update: vi.fn(),
}));
vi.mock('@/entities/feedback/actions/submitAiFeedbackAction', () => ({
    submitAiFeedbackAction: actions.submit,
}));
vi.mock('@/entities/feedback/actions/updateAiFeedbackAction', () => ({
    updateAiFeedbackAction: actions.update,
}));
const toast = vi.hoisted(() => ({ showToast: vi.fn(), dismiss: vi.fn() }));
vi.mock('@/shared/ui/ToastProvider', () => ({
    useOptionalToast: () => toast,
}));

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
    AnalysisFeedbackContext,
    FeedbackActionResult,
    SubmitAiFeedbackResult,
} from '@/entities/feedback/types';
import { type AiFeedbackTarget, feedbackIdentityKey } from '../model/targets';
import { AiFeedbackButtons } from '../ui/AiFeedbackButtons';
import { mockViewport } from '@/__tests__/utils/mockViewport';

const CONTEXT: AnalysisFeedbackContext = {
    analysisType: 'technical',
    symbol: 'AAPL',
    timeframe: '1Day',
    modelId: 'deepseek-v4-flash',
    reasoning: false,
    analyzedAt: '2026-11-08T01:00:00.000Z',
};
const SNAPSHOT = { summary: '상승 추세입니다.' };

function analysisTarget(
    context: AnalysisFeedbackContext = CONTEXT
): AiFeedbackTarget {
    return { surface: 'siglens', context, snapshot: SNAPSHOT };
}

const OK_SUBMIT: SubmitAiFeedbackResult = { ok: true, id: 'fb-1' };
const OK: FeedbackActionResult = { ok: true };

/** 확인 문구 영역. 역할 없이 `aria-live`만 가진다(화면의 다른 status와 겹치지 않게). */
const liveRegion = () =>
    document.querySelector('[aria-live="polite"]') as HTMLElement;
const up = () => screen.getByRole('button', { name: '도움이 됐어요' });
const down = () => screen.getByRole('button', { name: '도움이 안 됐어요' });

describe('AiFeedbackButtons', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockViewport(false);
        actions.submit.mockResolvedValue(OK_SUBMIT);
        actions.update.mockResolvedValue(OK);
    });
    afterEach(() => vi.unstubAllGlobals());

    it('결과 종류에 맞는 그룹 이름을 단다', () => {
        const { rerender } = render(
            <AiFeedbackButtons target={analysisTarget()} />
        );
        expect(
            screen.getByRole('group', { name: '이 분석이 도움이 됐나요?' })
        ).toBeInTheDocument();

        rerender(
            <AiFeedbackButtons
                target={{
                    surface: 'siglens_ai',
                    context: { guest: true, messageIndex: 1 },
                    getTranscript: () => [],
                }}
            />
        );
        expect(
            screen.getByRole('group', { name: '이 답변이 도움이 됐나요?' })
        ).toBeInTheDocument();
    });

    it('처음에는 아무것도 눌려 있지 않다', () => {
        render(<AiFeedbackButtons target={analysisTarget()} />);

        expect(up()).toHaveAttribute('aria-pressed', 'false');
        expect(down()).toHaveAttribute('aria-pressed', 'false');
        expect(actions.submit).not.toHaveBeenCalled();
    });

    describe('👍', () => {
        it('누르면 맥락·스냅샷·경로와 함께 저장하고 확인 문구를 보인다', async () => {
            const user = userEvent.setup();
            render(<AiFeedbackButtons target={analysisTarget()} />);

            await user.click(up());

            expect(up()).toHaveAttribute('aria-pressed', 'true');
            expect(actions.submit).toHaveBeenCalledTimes(1);
            expect(actions.submit).toHaveBeenCalledWith({
                surface: 'siglens',
                vote: 'up',
                context: CONTEXT,
                snapshot: SNAPSHOT,
                pagePath: window.location.pathname,
            });
            await waitFor(() =>
                expect(liveRegion()).toHaveTextContent('의견 고마워요')
            );
        });

        it('같은 👍를 다시 눌러도 다시 저장하지 않는다', async () => {
            const user = userEvent.setup();
            render(<AiFeedbackButtons target={analysisTarget()} />);

            await user.click(up());
            await user.click(up());

            expect(actions.submit).toHaveBeenCalledTimes(1);
            expect(actions.update).not.toHaveBeenCalled();
        });

        it('저장이 실패하면 눌림을 되돌리고 토스트로 알린다', async () => {
            actions.submit.mockResolvedValue({
                ok: false,
                code: 'submission_failed',
            });
            const user = userEvent.setup();
            render(<AiFeedbackButtons target={analysisTarget()} />);

            await user.click(up());

            await waitFor(() =>
                expect(up()).toHaveAttribute('aria-pressed', 'false')
            );
            expect(toast.showToast).toHaveBeenCalledWith({
                message: '의견을 보내지 못했어요. 잠시 후 다시 시도해 주세요.',
            });
        });

        it('액션이 던져도 같은 방식으로 되돌린다', async () => {
            actions.submit.mockRejectedValue(new Error('network'));
            const user = userEvent.setup();
            render(<AiFeedbackButtons target={analysisTarget()} />);

            await user.click(up());

            await waitFor(() =>
                expect(up()).toHaveAttribute('aria-pressed', 'false')
            );
            expect(toast.showToast).toHaveBeenCalledTimes(1);
        });

        it('실패 뒤 다시 누르면 새로 저장을 시도한다', async () => {
            actions.submit
                .mockResolvedValueOnce({ ok: false, code: 'rate_limited' })
                .mockResolvedValueOnce(OK_SUBMIT);
            const user = userEvent.setup();
            render(<AiFeedbackButtons target={analysisTarget()} />);

            await user.click(up());
            await waitFor(() =>
                expect(up()).toHaveAttribute('aria-pressed', 'false')
            );
            await user.click(up());

            await waitFor(() =>
                expect(up()).toHaveAttribute('aria-pressed', 'true')
            );
            expect(actions.submit).toHaveBeenCalledTimes(2);
        });
    });

    describe('👎', () => {
        it('누르면 먼저 저장하고 사유 입력창을 연다', async () => {
            const user = userEvent.setup();
            render(<AiFeedbackButtons target={analysisTarget()} />);

            await user.click(down());

            expect(actions.submit).toHaveBeenCalledWith(
                expect.objectContaining({ vote: 'down' })
            );
            expect(down()).toHaveAttribute('aria-pressed', 'true');
            expect(
                screen.getByRole('dialog', { name: '어떤 점이 아쉬웠나요?' })
            ).toBeInTheDocument();
            // 아직 사유를 보내지 않았으므로 확인 문구는 없다.
            expect(liveRegion()).toBeEmptyDOMElement();
        });

        it('사유 칩은 여러 개 고를 수 있고 다시 누르면 해제된다', async () => {
            const user = userEvent.setup();
            render(<AiFeedbackButtons target={analysisTarget()} />);
            await user.click(down());

            const inaccurate = screen.getByRole('button', {
                name: '사실과 달라요',
            });
            const unsupported = screen.getByRole('button', {
                name: '근거가 부족해요',
            });
            await user.click(inaccurate);
            await user.click(unsupported);
            expect(inaccurate).toHaveAttribute('aria-pressed', 'true');
            expect(unsupported).toHaveAttribute('aria-pressed', 'true');

            await user.click(inaccurate);
            expect(inaccurate).toHaveAttribute('aria-pressed', 'false');
            expect(unsupported).toHaveAttribute('aria-pressed', 'true');
        });

        it('보내기는 저장된 행 id로 사유와 한 줄 의견을 갱신하고 입력창을 닫는다', async () => {
            const user = userEvent.setup();
            render(<AiFeedbackButtons target={analysisTarget()} />);
            await user.click(down());
            await user.click(
                screen.getByRole('button', { name: '사실과 달라요' })
            );
            await user.click(screen.getByRole('button', { name: '기타' }));
            await user.type(
                screen.getByLabelText('한 줄 의견 (선택)'),
                '  수치가 틀렸어요  '
            );

            await user.click(screen.getByRole('button', { name: '보내기' }));

            await waitFor(() =>
                expect(actions.update).toHaveBeenCalledWith({
                    id: 'fb-1',
                    reasons: ['inaccurate', 'other'],
                    comment: '수치가 틀렸어요',
                })
            );
            await waitFor(() =>
                expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
            );
            expect(liveRegion()).toHaveTextContent('의견 고마워요');
            expect(down()).toHaveAttribute('aria-pressed', 'true');
        });

        it('의견을 비우면 comment 키를 보내지 않는다', async () => {
            const user = userEvent.setup();
            render(<AiFeedbackButtons target={analysisTarget()} />);
            await user.click(down());
            await user.click(
                screen.getByRole('button', { name: '너무 길거나 어려워요' })
            );

            await user.click(screen.getByRole('button', { name: '보내기' }));

            await waitFor(() =>
                expect(actions.update).toHaveBeenCalledWith({
                    id: 'fb-1',
                    reasons: ['too_long'],
                })
            );
        });

        it('한 줄 의견 입력은 최대 길이를 넘기지 못한다', async () => {
            const user = userEvent.setup();
            render(<AiFeedbackButtons target={analysisTarget()} />);
            await user.click(down());

            expect(screen.getByLabelText('한 줄 의견 (선택)')).toHaveAttribute(
                'maxlength',
                '500'
            );
        });

        it('사유를 보내지 못하면 입력창을 열어 둔 채 토스트로 알린다', async () => {
            actions.update.mockResolvedValue({
                ok: false,
                code: 'submission_failed',
            });
            const user = userEvent.setup();
            render(<AiFeedbackButtons target={analysisTarget()} />);
            await user.click(down());

            await user.click(screen.getByRole('button', { name: '보내기' }));

            await waitFor(() =>
                expect(toast.showToast).toHaveBeenCalledTimes(1)
            );
            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(liveRegion()).toBeEmptyDOMElement();
        });

        it('닫아도 👎 평가는 남고, 다시 누르면 입력창이 다시 열린다', async () => {
            const user = userEvent.setup();
            render(<AiFeedbackButtons target={analysisTarget()} />);
            await user.click(down());

            await user.click(screen.getByRole('button', { name: '닫기' }));
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            expect(down()).toHaveAttribute('aria-pressed', 'true');

            await user.click(down());

            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(actions.submit).toHaveBeenCalledTimes(1);
        });

        it('저장이 실패하면 입력창을 열지 않고 눌림을 되돌린다', async () => {
            actions.submit.mockResolvedValue({
                ok: false,
                code: 'submission_failed',
            });
            const user = userEvent.setup();
            render(<AiFeedbackButtons target={analysisTarget()} />);

            await user.click(down());

            await waitFor(() =>
                expect(down()).toHaveAttribute('aria-pressed', 'false')
            );
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            expect(toast.showToast).toHaveBeenCalledTimes(1);
        });

        it('모바일 뷰포트에서는 같은 입력창을 중앙 모달로 연다', async () => {
            mockViewport(true);
            const user = userEvent.setup();
            render(<AiFeedbackButtons target={analysisTarget()} />);

            await user.click(down());

            expect(screen.getByTestId('popover-backdrop')).toBeInTheDocument();
            expect(screen.getByRole('dialog')).toHaveAttribute(
                'aria-modal',
                'true'
            );
        });
    });

    describe('방향 바꾸기', () => {
        it('👍 뒤 👎로 바꾸면 새 행을 만들지 않고 같은 행의 vote를 갱신한다', async () => {
            const user = userEvent.setup();
            render(<AiFeedbackButtons target={analysisTarget()} />);
            await user.click(up());
            await waitFor(() =>
                expect(liveRegion()).toHaveTextContent('의견 고마워요')
            );

            await user.click(down());

            await waitFor(() =>
                expect(actions.update).toHaveBeenCalledWith({
                    id: 'fb-1',
                    vote: 'down',
                })
            );
            expect(actions.submit).toHaveBeenCalledTimes(1);
            expect(down()).toHaveAttribute('aria-pressed', 'true');
            expect(up()).toHaveAttribute('aria-pressed', 'false');
            // 👎로 바뀌면 이전 👍의 확인 문구는 사라지고 입력창이 열린다.
            expect(liveRegion()).toBeEmptyDOMElement();
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        it('👎 뒤 👍로 바꾸면 입력창을 닫고 vote만 갱신한다', async () => {
            const user = userEvent.setup();
            render(<AiFeedbackButtons target={analysisTarget()} />);
            await user.click(down());

            await user.click(up());

            await waitFor(() =>
                expect(actions.update).toHaveBeenCalledWith({
                    id: 'fb-1',
                    vote: 'up',
                })
            );
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            expect(up()).toHaveAttribute('aria-pressed', 'true');
        });

        it('방향을 바꾸는 갱신이 실패하면 직전 평가로 되돌린다', async () => {
            const user = userEvent.setup();
            render(<AiFeedbackButtons target={analysisTarget()} />);
            await user.click(up());
            await waitFor(() =>
                expect(liveRegion()).toHaveTextContent('의견 고마워요')
            );
            actions.update.mockResolvedValue({
                ok: false,
                code: 'not_found',
            });

            await user.click(down());

            await waitFor(() =>
                expect(up()).toHaveAttribute('aria-pressed', 'true')
            );
            expect(down()).toHaveAttribute('aria-pressed', 'false');
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            expect(toast.showToast).toHaveBeenCalledTimes(1);
        });

        it('첫 저장이 끝나기 전에 방향을 바꿔도 저장은 한 번이고 갱신이 그 id를 기다린다', async () => {
            let resolveSubmit: (r: SubmitAiFeedbackResult) => void = () => {};
            actions.submit.mockReturnValue(
                new Promise<SubmitAiFeedbackResult>(resolve => {
                    resolveSubmit = resolve;
                })
            );
            const user = userEvent.setup();
            render(<AiFeedbackButtons target={analysisTarget()} />);

            await user.click(up());
            await user.click(down());
            expect(actions.update).not.toHaveBeenCalled();

            resolveSubmit(OK_SUBMIT);

            await waitFor(() =>
                expect(actions.update).toHaveBeenCalledWith({
                    id: 'fb-1',
                    vote: 'down',
                })
            );
            expect(actions.submit).toHaveBeenCalledTimes(1);
        });

        it('첫 저장이 실패하면 연달아 누른 선택도 갱신 없이 되돌리고 토스트는 한 번만 띄운다', async () => {
            let resolveSubmit: (r: SubmitAiFeedbackResult) => void = () => {};
            actions.submit.mockReturnValue(
                new Promise<SubmitAiFeedbackResult>(resolve => {
                    resolveSubmit = resolve;
                })
            );
            const user = userEvent.setup();
            render(<AiFeedbackButtons target={analysisTarget()} />);

            await user.click(up());
            await user.click(down());
            resolveSubmit({ ok: false, code: 'submission_failed' });

            await waitFor(() =>
                expect(toast.showToast).toHaveBeenCalledTimes(1)
            );
            expect(up()).toHaveAttribute('aria-pressed', 'false');
            expect(down()).toHaveAttribute('aria-pressed', 'false');
            expect(actions.update).not.toHaveBeenCalled();
        });

        it('더 새로운 선택이 있으면 앞선 갱신 실패는 화면을 되돌리지 않는다', async () => {
            let rejectFirst: (r: FeedbackActionResult) => void = () => {};
            actions.update
                .mockReturnValueOnce(
                    new Promise<FeedbackActionResult>(resolve => {
                        rejectFirst = resolve;
                    })
                )
                .mockResolvedValueOnce(OK);
            const user = userEvent.setup();
            render(<AiFeedbackButtons target={analysisTarget()} />);

            await user.click(up());
            await waitFor(() =>
                expect(liveRegion()).toHaveTextContent('의견 고마워요')
            );
            await user.click(down());
            await user.click(up());
            await waitFor(() =>
                expect(actions.update).toHaveBeenCalledTimes(2)
            );
            rejectFirst({ ok: false, code: 'submission_failed' });

            await waitFor(() =>
                expect(actions.update).toHaveBeenCalledTimes(2)
            );
            expect(up()).toHaveAttribute('aria-pressed', 'true');
            expect(toast.showToast).not.toHaveBeenCalled();
        });
    });

    describe('대상이 바뀔 때', () => {
        it('다른 결과로 바뀌면 눌러 둔 평가와 입력창을 비운다', async () => {
            const user = userEvent.setup();
            const { rerender } = render(
                <AiFeedbackButtons target={analysisTarget()} />
            );
            await user.click(down());
            expect(screen.getByRole('dialog')).toBeInTheDocument();

            rerender(
                <AiFeedbackButtons
                    target={analysisTarget({ ...CONTEXT, symbol: 'TSLA' })}
                />
            );

            expect(down()).toHaveAttribute('aria-pressed', 'false');
            expect(up()).toHaveAttribute('aria-pressed', 'false');
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

            await user.click(up());
            expect(actions.submit).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    context: expect.objectContaining({ symbol: 'TSLA' }),
                })
            );
            expect(actions.submit).toHaveBeenCalledTimes(2);
        });

        it('같은 결과의 표현만 바뀌면(쉽게보기/원본) 평가를 유지한다', async () => {
            const user = userEvent.setup();
            const { rerender } = render(
                <AiFeedbackButtons
                    target={analysisTarget({ ...CONTEXT, viewMode: 'plain' })}
                />
            );
            await user.click(up());

            rerender(
                <AiFeedbackButtons
                    target={analysisTarget({ ...CONTEXT, viewMode: 'full' })}
                />
            );

            expect(up()).toHaveAttribute('aria-pressed', 'true');
        });

        it('resetKey가 있으면 그것이 리셋 기준이다(챗: 다시 생성한 답)', async () => {
            const target: AiFeedbackTarget = {
                surface: 'siglens_ai',
                context: { guest: true, messageIndex: 1 },
                getTranscript: () => [],
            };
            const user = userEvent.setup();
            const { rerender } = render(
                <AiFeedbackButtons target={target} resetKey="a1" />
            );
            await user.click(up());

            rerender(<AiFeedbackButtons target={target} resetKey="a1" />);
            expect(up()).toHaveAttribute('aria-pressed', 'true');

            rerender(<AiFeedbackButtons target={target} resetKey="a2" />);
            expect(up()).toHaveAttribute('aria-pressed', 'false');
        });
    });

    describe('시그렌즈 AI 답변', () => {
        it('누른 순간의 대화 기록을 스냅샷으로 보낸다', async () => {
            const transcript = [
                { role: 'user', content: '애플 어때?' },
                { role: 'assistant', content: '상승 추세입니다.' },
            ] as const;
            const getTranscript = vi.fn(() => transcript);
            const user = userEvent.setup();
            render(
                <AiFeedbackButtons
                    target={{
                        surface: 'siglens_ai',
                        context: {
                            guest: false,
                            conversationId: 'conv-1',
                            messageId: 'msg-2',
                            messageIndex: 1,
                        },
                        getTranscript,
                    }}
                    popoverPlacement="above"
                />
            );
            // 렌더만으로는 대화 기록을 만들지 않는다.
            expect(getTranscript).not.toHaveBeenCalled();

            await user.click(up());

            expect(actions.submit).toHaveBeenCalledWith({
                surface: 'siglens_ai',
                vote: 'up',
                context: {
                    guest: false,
                    conversationId: 'conv-1',
                    messageId: 'msg-2',
                    messageIndex: 1,
                },
                snapshot: transcript,
                pagePath: window.location.pathname,
            });
            expect(getTranscript).toHaveBeenCalledTimes(1);
        });
    });
});

describe('feedbackIdentityKey', () => {
    it('viewMode는 키에 영향을 주지 않는다', () => {
        expect(
            feedbackIdentityKey(
                analysisTarget({ ...CONTEXT, viewMode: 'plain' })
            )
        ).toBe(
            feedbackIdentityKey(
                analysisTarget({ ...CONTEXT, viewMode: 'full' })
            )
        );
    });

    it('종목·타임프레임·모델·분석 시각이 달라지면 키가 달라진다', () => {
        const base = feedbackIdentityKey(analysisTarget());
        const variants: Partial<AnalysisFeedbackContext>[] = [
            { symbol: 'TSLA' },
            { timeframe: '1Hour' },
            { modelId: 'other-model' },
            { analyzedAt: '2026-11-09T01:00:00.000Z' },
            { extra: { expirationDate: '2026-12-18' } },
        ];
        for (const variant of variants) {
            expect(
                feedbackIdentityKey(analysisTarget({ ...CONTEXT, ...variant }))
            ).not.toBe(base);
        }
    });

    it('시각 필드가 없는 위젯도 새 결과 객체가 오면 키가 바뀌고 같은 객체면 유지된다', () => {
        const first = { summary: 'a' };
        const second = { summary: 'a' };
        const keyOf = (snapshot: unknown) =>
            feedbackIdentityKey({
                surface: 'siglens',
                context: CONTEXT,
                snapshot,
            });
        expect(keyOf(first)).toBe(keyOf(first));
        expect(keyOf(first)).not.toBe(keyOf(second));
    });

    it('챗은 대화·메시지·위치로 구분한다', () => {
        const key = (messageIndex: number, messageId?: string) =>
            feedbackIdentityKey({
                surface: 'siglens_ai',
                context: { guest: false, messageIndex, messageId },
                getTranscript: () => [],
            });
        expect(key(1, 'm1')).not.toBe(key(1, 'm2'));
        expect(key(1, 'm1')).not.toBe(key(3, 'm1'));
    });
});
