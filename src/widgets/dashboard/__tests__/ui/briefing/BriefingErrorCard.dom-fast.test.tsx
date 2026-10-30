import { render, screen } from '@testing-library/react';
import { BriefingErrorCard } from '@/widgets/dashboard/ui/briefing/BriefingErrorCard';

describe('BriefingErrorCard', () => {
    it('renders error state with alert role', () => {
        render(<BriefingErrorCard />);
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/불러오지 못했어요/)).toBeInTheDocument();
    });
});
