import { render, screen } from '@testing-library/react';
import { StrikeVolumeTooltipBody } from '@/widgets/options/ui/volume-chart/StrikeVolumeTooltipBody';

describe('StrikeVolumeTooltipBody', () => {
    it('shows the strike and call, put and combined volume', () => {
        render(
            <StrikeVolumeTooltipBody
                row={{ strike: 150, callVolume: 1200, putVolume: 300 }}
            />
        );
        expect(screen.getByText('Strike $150')).toBeInTheDocument();
        expect(screen.getByText('Call Vol')).toBeInTheDocument();
        expect(screen.getByText('Put Vol')).toBeInTheDocument();
        expect(screen.getByText(/^1,200 /)).toBeInTheDocument();
        expect(screen.getByText(/^300 /)).toBeInTheDocument();
        expect(screen.getByText(/^1,500 /)).toBeInTheDocument();
    });
});
