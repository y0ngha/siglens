import { render, screen } from '@testing-library/react';
import { ChartEmptyCard } from '@/widgets/options/ui/strike-chart/ChartEmptyCard';

describe('ChartEmptyCard', () => {
    it('shows the title and the message', () => {
        render(<ChartEmptyCard title="Chart title" message="Nothing here" />);
        expect(screen.getByText('Chart title')).toBeInTheDocument();
        expect(screen.getByText('Nothing here')).toBeInTheDocument();
    });
});
