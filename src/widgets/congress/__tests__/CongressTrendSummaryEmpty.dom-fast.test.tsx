import { render, screen } from '@testing-library/react';

import { CongressTrendSummaryEmpty } from '../CongressTrendSummaryEmpty';

describe('CongressTrendSummaryEmpty', () => {
    it('renders the same heading as the loaded/error states so the section title stays stable', () => {
        render(<CongressTrendSummaryEmpty />);

        expect(
            screen.getByRole('heading', { name: 'AI 동향 해석' })
        ).toBeInTheDocument();
    });

    it('explains that zero trades is a policy skip, not an error', () => {
        render(<CongressTrendSummaryEmpty />);

        expect(
            screen.getByText(
                '최근 의회 거래가 없어 동향 해석을 생성하지 않았어요.'
            )
        ).toBeInTheDocument();
    });

    it('labels the section via aria-labelledby pointing at its own heading id', () => {
        render(<CongressTrendSummaryEmpty />);

        const section = screen.getByRole('region', { name: 'AI 동향 해석' });
        expect(section).toHaveAttribute(
            'aria-labelledby',
            'congress-trend-summary-empty-heading'
        );
    });
});
