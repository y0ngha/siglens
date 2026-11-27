import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StaleAnalysisBanner } from '@/widgets/analysis/StaleAnalysisBanner';

describe('StaleAnalysisBanner', () => {
    it('renders the stale message and triggers onReanalyze when clicked', async () => {
        const user = userEvent.setup();
        const onReanalyze = vi.fn();
        render(
            <StaleAnalysisBanner
                onReanalyze={onReanalyze}
                reanalyzeCooldownUntil={0}
            />
        );
        expect(
            screen.getByText(/AI 분석 결과가 오래됐어요/)
        ).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: /재분석/ }));
        expect(onReanalyze).toHaveBeenCalledTimes(1);
    });

    // jsdom은 레이아웃을 재지 못해 클래스만 고정한다. 실제 폭 검증(240px 패널, ko/en/ja/zh에서
    // scrollWidth <= clientWidth)은 Playwright로 따로 했고 이 PR에는 E2E를 추가하지 않았다.
    it('재분석 버튼은 줄어들거나 글자 단위로 쪼개지지 않는다(DS-18)', () => {
        render(
            <StaleAnalysisBanner
                onReanalyze={vi.fn()}
                reanalyzeCooldownUntil={0}
            />
        );
        expect(
            screen.getByRole('button', { name: /재분석/ }).parentElement
        ).toHaveClass('shrink-0');
    });

    it('안내 문구는 좁은 폭에서 줄바꿈으로 양보한다(DS-18)', () => {
        render(
            <StaleAnalysisBanner
                onReanalyze={vi.fn()}
                reanalyzeCooldownUntil={0}
            />
        );
        expect(screen.getByText(/AI 분석 결과가 오래됐어요/)).toHaveClass(
            'min-w-0',
            'wrap-anywhere'
        );
    });

    it('버튼에 포인터가 올라가거나 포커스가 가면 onReanalyzeIntent를 부른다', () => {
        const onReanalyzeIntent = vi.fn();
        render(
            <StaleAnalysisBanner
                onReanalyze={vi.fn()}
                onReanalyzeIntent={onReanalyzeIntent}
                reanalyzeCooldownUntil={0}
            />
        );
        const button = screen.getByRole('button', { name: /재분석/ });

        fireEvent.pointerEnter(button);
        fireEvent.focus(button);

        expect(onReanalyzeIntent).toHaveBeenCalledTimes(2);
    });

    it('marks the reanalyze button aria-disabled (not disabled) while cooldown is active', () => {
        const onReanalyze = vi.fn();
        render(
            <StaleAnalysisBanner
                onReanalyze={onReanalyze}
                reanalyzeCooldownUntil={Date.now() + 60_000}
            />
        );
        const button = screen.getByRole('button', { name: /재분석/ });
        // `disabled`면 포커스 중 쿨다운이 걸릴 때 포커스가 body로 떨어진다(REACT.md#AX-3).
        expect(button).toHaveAttribute('aria-disabled', 'true');
        expect(button).not.toBeDisabled();
    });

    it('does not invoke onReanalyze when the button is clicked while cooling down', async () => {
        const user = userEvent.setup();
        const onReanalyze = vi.fn();
        render(
            <StaleAnalysisBanner
                onReanalyze={onReanalyze}
                reanalyzeCooldownUntil={Date.now() + 60_000}
            />
        );
        await user.click(screen.getByRole('button', { name: /재분석/ }));
        expect(onReanalyze).not.toHaveBeenCalled();
    });
});
