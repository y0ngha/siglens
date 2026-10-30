import { render, screen } from '@testing-library/react';
import { BriefingLoadingCard } from '@/widgets/dashboard/ui/briefing/BriefingLoadingCard';

describe('BriefingLoadingCard', () => {
    it('renders loading state with status role', () => {
        render(<BriefingLoadingCard />);
        expect(screen.getByRole('status')).toBeInTheDocument();
        expect(screen.getByText(/브리핑 생성 중/)).toBeInTheDocument();
    });

    it('reserves the estimated card height (min-h-64) so the panel below does not shift', () => {
        render(<BriefingLoadingCard />);
        expect(screen.getByRole('status')).toHaveClass('min-h-64');
    });
});
