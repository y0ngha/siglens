import { render, screen } from '@testing-library/react';
import { StrikeTooltipRows } from '@/widgets/options/ui/strike-chart/StrikeTooltipRows';

describe('StrikeTooltipRows', () => {
    it('renders the strike heading, both sides and the total', () => {
        render(
            <StrikeTooltipRows
                strike={1050}
                callLabel="Call X"
                putLabel="Put X"
                totalLabel="Total"
                callValue="1 call"
                putValue="2 put"
                totalValue="3 all"
            />
        );
        expect(screen.getByText('Strike $1,050')).toBeInTheDocument();
        expect(screen.getByText('Call X')).toBeInTheDocument();
        expect(screen.getByText('1 call')).toBeInTheDocument();
        expect(screen.getByText('Put X')).toBeInTheDocument();
        expect(screen.getByText('2 put')).toBeInTheDocument();
        expect(screen.getByText('Total')).toBeInTheDocument();
        expect(screen.getByText('3 all')).toBeInTheDocument();
    });
});
