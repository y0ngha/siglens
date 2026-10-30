import { render, screen } from '@testing-library/react';
import { OpenInterestTooltipBody } from '@/widgets/options/ui/oi-chart/OpenInterestTooltipBody';

describe('OpenInterestTooltipBody', () => {
    it('shows the strike and call, put and combined OI', () => {
        render(
            <OpenInterestTooltipBody
                row={{
                    strike: 150,
                    callOpenInterest: 1000,
                    putOpenInterest: 800,
                }}
            />
        );
        expect(screen.getByText('Strike $150')).toBeInTheDocument();
        expect(screen.getByText('Call OI')).toBeInTheDocument();
        expect(screen.getByText('Put OI')).toBeInTheDocument();
        expect(screen.getByText(/^1,000 /)).toBeInTheDocument();
        expect(screen.getByText(/^800 /)).toBeInTheDocument();
        expect(screen.getByText(/^1,800 /)).toBeInTheDocument();
    });
});
