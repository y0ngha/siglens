import { render, screen } from '@testing-library/react';

import { FundamentalAiSummarySkeleton } from '../FundamentalAiSummarySkeleton';

describe('FundamentalAiSummarySkeleton', () => {
    it('renders the heading', () => {
        render(<FundamentalAiSummarySkeleton />);

        expect(
            screen.getByRole('heading', { name: /AI 펀더멘털 분석/ })
        ).toBeInTheDocument();
    });

    it('sets aria-busy on the section', () => {
        render(<FundamentalAiSummarySkeleton />);

        const section = screen.getByRole('region', {
            name: /AI 펀더멘털 분석/,
        });
        expect(section).toHaveAttribute('aria-busy', 'true');
    });

    it('renders a loading progress message', () => {
        render(<FundamentalAiSummarySkeleton />);

        expect(
            screen.getByText('AI 펀더멘털 분석 진행 중…')
        ).toBeInTheDocument();
    });

    it('renders skeleton lines', () => {
        const { container } = render(<FundamentalAiSummarySkeleton />);

        const skeletonLines = container.querySelectorAll(
            '.animate-pulse.rounded'
        );
        expect(skeletonLines.length).toBeGreaterThanOrEqual(3);
    });
});
