import { render, screen } from '@testing-library/react';
import { OpenInterestLegend } from '@/widgets/options/ui/oi-chart/OpenInterestLegend';

describe('OpenInterestLegend', () => {
    it('lists call, put, Max Pain and current price when Max Pain is shown', () => {
        render(<OpenInterestLegend showMaxPain />);
        expect(screen.getByText(/Call OI/)).toBeInTheDocument();
        expect(screen.getByText(/Put OI/)).toBeInTheDocument();
        expect(screen.getByText('Max Pain')).toBeInTheDocument();
        expect(screen.getByText('현재가')).toBeInTheDocument();
    });

    it('drops the Max Pain entry when it is not shown', () => {
        render(<OpenInterestLegend showMaxPain={false} />);
        expect(screen.queryByText('Max Pain')).not.toBeInTheDocument();
        expect(screen.getByText('현재가')).toBeInTheDocument();
    });
});
