import { render, screen } from '@testing-library/react';
import { StrikeVolumeLegend } from '@/widgets/options/ui/volume-chart/StrikeVolumeLegend';

describe('StrikeVolumeLegend', () => {
    it('lists call, put and current price but no Max Pain', () => {
        render(<StrikeVolumeLegend />);
        expect(screen.getByText(/Call Vol/)).toBeInTheDocument();
        expect(screen.getByText(/Put Vol/)).toBeInTheDocument();
        expect(screen.getByText('현재가')).toBeInTheDocument();
        expect(screen.queryByText('Max Pain')).not.toBeInTheDocument();
    });
});
