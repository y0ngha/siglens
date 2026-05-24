/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StaleAnalysisBanner } from '@/widgets/analysis/StaleAnalysisBanner';

describe('StaleAnalysisBanner', () => {
    it('renders the stale message and triggers onReanalyze when clicked', async () => {
        const user = userEvent.setup();
        const onReanalyze = jest.fn();
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

    it('disables the reanalyze button while cooldown is active', () => {
        const onReanalyze = jest.fn();
        render(
            <StaleAnalysisBanner
                onReanalyze={onReanalyze}
                reanalyzeCooldownMs={60_000}
            />
        );
        const button = screen.getByRole('button', { name: /재분석/ });
        expect(button).toBeDisabled();
    });

    it('does not invoke onReanalyze when the button is clicked while cooling down', async () => {
        const user = userEvent.setup();
        const onReanalyze = jest.fn();
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
