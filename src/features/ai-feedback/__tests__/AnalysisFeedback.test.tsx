const actions = vi.hoisted(() => ({ submit: vi.fn(), update: vi.fn() }));
vi.mock('@/entities/feedback/actions/submitAiFeedbackAction', () => ({
    submitAiFeedbackAction: actions.submit,
}));
vi.mock('@/entities/feedback/actions/updateAiFeedbackAction', () => ({
    updateAiFeedbackAction: actions.update,
}));

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ANALYSIS_VIEW_STORAGE_KEY } from '@/shared/model/analysisView';
import { AnalysisFeedback } from '../ui/AnalysisFeedback';

const CONTEXT = {
    analysisType: 'fundamental' as const,
    symbol: 'AAPL',
    modelId: 'deepseek-v4-flash',
    reasoning: false,
};
const RESULT = { summary: '현금흐름이 탄탄합니다.' };

async function clickUpAndGetContext() {
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '도움이 됐어요' }));
    await waitFor(() => expect(actions.submit).toHaveBeenCalledTimes(1));
    return actions.submit.mock.calls[0]![0];
}

describe('AnalysisFeedback', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        actions.submit.mockResolvedValue({ ok: true, id: 'fb-1' });
    });
    afterEach(() => localStorage.clear());

    it('쉽게보기 산문이 있고 쉽게보기 모드(기본)면 viewMode가 plain이다', async () => {
        render(
            <AnalysisFeedback
                context={CONTEXT}
                snapshot={RESULT}
                plain="쉬운 설명입니다."
            />
        );

        const input = await clickUpAndGetContext();

        expect(input).toEqual({
            surface: 'siglens',
            vote: 'up',
            context: { ...CONTEXT, viewMode: 'plain' },
            snapshot: RESULT,
            pagePath: window.location.pathname,
        });
    });

    it('원본보기를 골랐으면 산문이 있어도 viewMode는 full이다', async () => {
        localStorage.setItem(ANALYSIS_VIEW_STORAGE_KEY, JSON.stringify('raw'));
        render(
            <AnalysisFeedback
                context={CONTEXT}
                snapshot={RESULT}
                plain="쉬운 설명입니다."
            />
        );

        const input = await clickUpAndGetContext();

        expect(input.context.viewMode).toBe('full');
    });

    it.each([null, undefined, '   '])(
        '산문이 %j이면(쉽게보기 토글이 없는 화면) 항상 full이다',
        async plain => {
            render(
                <AnalysisFeedback
                    context={CONTEXT}
                    snapshot={RESULT}
                    plain={plain}
                />
            );

            const input = await clickUpAndGetContext();

            expect(input.context.viewMode).toBe('full');
        }
    );

    it('쉽게보기/원본 전환은 눌러 둔 평가를 지우지 않는다', async () => {
        const user = userEvent.setup();
        const { rerender } = render(
            <AnalysisFeedback
                context={CONTEXT}
                snapshot={RESULT}
                plain="쉬운 설명입니다."
            />
        );
        await user.click(screen.getByRole('button', { name: '도움이 됐어요' }));

        localStorage.setItem(ANALYSIS_VIEW_STORAGE_KEY, JSON.stringify('raw'));
        rerender(
            <AnalysisFeedback
                context={CONTEXT}
                snapshot={RESULT}
                plain="쉬운 설명입니다."
            />
        );

        expect(
            screen.getByRole('button', { name: '도움이 됐어요' })
        ).toHaveAttribute('aria-pressed', 'true');
    });

    it('종목이 바뀌면 평가가 비워진다', async () => {
        const user = userEvent.setup();
        const { rerender } = render(
            <AnalysisFeedback context={CONTEXT} snapshot={RESULT} />
        );
        await user.click(screen.getByRole('button', { name: '도움이 됐어요' }));

        rerender(
            <AnalysisFeedback
                context={{ ...CONTEXT, symbol: 'TSLA' }}
                snapshot={RESULT}
            />
        );

        expect(
            screen.getByRole('button', { name: '도움이 됐어요' })
        ).toHaveAttribute('aria-pressed', 'false');
    });
});
