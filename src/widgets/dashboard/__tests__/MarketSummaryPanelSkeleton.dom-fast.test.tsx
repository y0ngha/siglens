import { render, screen } from '@testing-library/react';
import { MarketSummaryPanelSkeleton } from '@/widgets/dashboard/MarketSummaryPanelSkeleton';
import { TEST_SCOPE } from './helpers/testScope';

describe('MarketSummaryPanelSkeleton', () => {
    it('renders an aria-busy section', () => {
        render(<MarketSummaryPanelSkeleton scope={TEST_SCOPE} />);
        const section = screen.getByLabelText('시장 현황 로딩 중');
        expect(section).toHaveAttribute('aria-busy', 'true');
    });

    it('renders skeleton placeholders for each market index', () => {
        const { container } = render(
            <MarketSummaryPanelSkeleton scope={TEST_SCOPE} />
        );
        const indexSkeletons = container.querySelectorAll('.grid-cols-2 > div');
        expect(indexSkeletons).toHaveLength(4);
    });
});
