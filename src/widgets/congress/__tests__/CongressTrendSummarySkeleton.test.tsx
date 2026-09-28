import { render, screen } from '@testing-library/react';

import { CongressTrendSummarySkeleton } from '../CongressTrendSummarySkeleton';

describe('CongressTrendSummarySkeleton', () => {
    it('renders the heading', () => {
        render(<CongressTrendSummarySkeleton />);

        expect(
            screen.getByRole('heading', { name: 'AI 동향 해석' })
        ).toBeInTheDocument();
    });

    it('sets aria-busy on the section', () => {
        render(<CongressTrendSummarySkeleton />);

        const section = screen.getByRole('region', { name: 'AI 동향 해석' });
        expect(section).toHaveAttribute('aria-busy', 'true');
    });

    it('renders a loading progress message', () => {
        render(<CongressTrendSummarySkeleton />);

        expect(screen.getByText('AI 동향 해석 진행 중…')).toBeInTheDocument();
    });

    it('reserves layout height with three pulsing placeholder lines (prevents CLS)', () => {
        const { container } = render(<CongressTrendSummarySkeleton />);

        const skeletonLines = container.querySelectorAll(
            '.animate-pulse.rounded'
        );
        expect(skeletonLines.length).toBeGreaterThanOrEqual(3);
    });

    it('namespaces its aria ids so it does not collide with sibling AI summary widgets on the same page', () => {
        const { container } = render(<CongressTrendSummarySkeleton />);

        expect(
            container.querySelector('#congress-trend-summary-loading-heading')
        ).not.toBeNull();
    });
});
