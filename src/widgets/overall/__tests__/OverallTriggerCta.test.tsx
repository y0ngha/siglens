import { render, screen, fireEvent } from '@testing-library/react';

import { OverallTriggerCta } from '../OverallTriggerCta';

describe('OverallTriggerCta', () => {
    it('renders the heading and description', () => {
        render(<OverallTriggerCta onTrigger={vi.fn()} />);

        expect(
            screen.getByRole('heading', { name: /AI 종합 분석/ })
        ).toBeInTheDocument();
        expect(
            screen.getByText(/차트·옵션·펀더멘털·뉴스·시장 분위기/)
        ).toBeInTheDocument();
    });

    it('calls onTrigger when the button is clicked', () => {
        const handleTrigger = vi.fn();
        render(<OverallTriggerCta onTrigger={handleTrigger} />);

        fireEvent.click(
            screen.getByRole('button', { name: /AI 종합 분석 받기/ })
        );

        expect(handleTrigger).toHaveBeenCalledTimes(1);
    });

    it('has an accessible section landmark', () => {
        render(<OverallTriggerCta onTrigger={vi.fn()} />);

        expect(
            screen.getByRole('region', { name: /AI 종합 분석/ })
        ).toBeInTheDocument();
    });
});
