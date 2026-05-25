vi.mock('@/shared/ui/DotSeparator', () => ({
    DotSeparator: () => <span aria-hidden="true">·</span>,
}));
vi.mock('@/shared/lib/skillStats', () => ({
    buildSkillStats: () => [
        { value: '25종 ', label: '보조지표' },
        { value: '18종 ', label: '캔들 패턴' },
    ],
}));

import React from 'react';
import { render, screen } from '@testing-library/react';

import { StatsBar, StatsBarSkeleton } from '../StatsBar';

describe('StatsBar', () => {
    it('renders stats from buildSkillStats', () => {
        render(<StatsBar skills={[]} />);

        expect(screen.getByText(/25종/)).toBeInTheDocument();
        expect(screen.getByText(/보조지표/)).toBeInTheDocument();
        expect(screen.getByText(/18종/)).toBeInTheDocument();
    });

    it('renders an accessible list', () => {
        render(<StatsBar skills={[]} />);

        expect(
            screen.getByRole('list', { name: /Siglens 분석 규모/ })
        ).toBeInTheDocument();
    });
});

describe('StatsBarSkeleton', () => {
    it('renders skeleton bars with aria-hidden', () => {
        const { container } = render(<StatsBarSkeleton />);

        expect(container.firstElementChild).toHaveAttribute(
            'aria-hidden',
            'true'
        );
    });
});
