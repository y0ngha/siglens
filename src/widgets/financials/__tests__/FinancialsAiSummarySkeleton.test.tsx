import { render, screen } from '@testing-library/react';

import { FinancialsAiSummarySkeleton } from '../FinancialsAiSummarySkeleton';

describe('FinancialsAiSummarySkeleton', () => {
    it('renders the heading', () => {
        render(<FinancialsAiSummarySkeleton />);

        expect(
            screen.getByRole('heading', { name: 'AI 재무제표 분석' })
        ).toBeInTheDocument();
    });

    it('sets aria-busy on the section', () => {
        render(<FinancialsAiSummarySkeleton />);

        const section = screen.getByRole('region', {
            name: 'AI 재무제표 분석',
        });
        expect(section).toHaveAttribute('aria-busy', 'true');
    });

    it('renders a loading progress message', () => {
        render(<FinancialsAiSummarySkeleton />);

        expect(
            screen.getByText('AI 재무제표 분석 진행 중…')
        ).toBeInTheDocument();
    });

    it('reserves layout height with three pulsing placeholder lines (prevents CLS)', () => {
        const { container } = render(<FinancialsAiSummarySkeleton />);

        const skeletonLines = container.querySelectorAll(
            '.animate-pulse.rounded'
        );
        expect(skeletonLines.length).toBeGreaterThanOrEqual(3);
    });

    it('namespaces its aria ids so it does not collide with sibling AI summary widgets on the same page', () => {
        const { container } = render(<FinancialsAiSummarySkeleton />);

        expect(
            container.querySelector('#financials-ai-summary-loading-heading')
        ).not.toBeNull();
    });
});
