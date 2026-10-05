import { render, screen } from '@testing-library/react';
import { ChartTabSkeleton } from '@/views/symbol/skeletons/ChartTabSkeleton';

describe('ChartTabSkeleton', () => {
    it('renders a loading message', () => {
        render(<ChartTabSkeleton />);

        expect(screen.getByText('데이터 로딩 중…')).toBeInTheDocument();
    });
});
