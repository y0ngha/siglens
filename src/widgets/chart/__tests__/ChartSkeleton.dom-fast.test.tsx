import { render, screen } from '@testing-library/react';
import { ChartSkeleton } from '@/widgets/chart/ChartSkeleton';

describe('ChartSkeleton', () => {
    it('renders the loading text', () => {
        render(<ChartSkeleton />);

        expect(screen.getByText('데이터 로딩 중…')).toBeInTheDocument();
    });
});
