vi.mock('@/shared/ui/MarkdownText', () => ({
    MarkdownText: ({ children }: { children: React.ReactNode }) => (
        <span>{children}</span>
    ),
}));

import React from 'react';
import { render, screen } from '@testing-library/react';

import { RiskFactors } from '../../sections/RiskFactors';

describe('RiskFactors', () => {
    it('renders nothing when factors is empty', () => {
        const { container } = render(<RiskFactors factors={[]} />);
        expect(container.innerHTML).toBe('');
    });

    it('renders the heading and factor items', () => {
        const factors = ['금리 인상 리스크', '지정학적 불안'];
        render(<RiskFactors factors={factors} />);

        expect(
            screen.getByRole('heading', { name: /위험 요인/ })
        ).toBeInTheDocument();
        expect(screen.getByText('금리 인상 리스크')).toBeInTheDocument();
        expect(screen.getByText('지정학적 불안')).toBeInTheDocument();
    });

    it('renders a list with the correct item count', () => {
        const factors = ['A', 'B', 'C'];
        render(<RiskFactors factors={factors} />);

        const list = screen.getByRole('list', { name: /위험 요인 목록/ });
        expect(list).toBeInTheDocument();
        expect(screen.getAllByRole('listitem')).toHaveLength(factors.length);
    });
});
