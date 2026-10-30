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
                reanalyzeCooldownMs={0}
            />
        );
        expect(
            screen.getByText(/AI 분석 결과가 오래됐어요/)
        ).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: /재분석/ }));
        expect(onReanalyze).toHaveBeenCalledTimes(1);
    });

    it('버튼에 포인터가 올라가거나 포커스가 가면 onReanalyzeIntent를 부른다', () => {
        const onReanalyzeIntent = vi.fn();
        render(
            <StaleAnalysisBanner
                onReanalyze={vi.fn()}
                onReanalyzeIntent={onReanalyzeIntent}
                reanalyzeCooldownMs={0}
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
                reanalyzeCooldownMs={60_000}
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
                reanalyzeCooldownMs={60_000}
            />
        );
        await user.click(screen.getByRole('button', { name: /재분석/ }));
        expect(onReanalyze).not.toHaveBeenCalled();
    });
});
