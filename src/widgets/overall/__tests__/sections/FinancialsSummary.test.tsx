vi.mock('@/shared/ui/MarkdownText', () => ({
    MarkdownText: ({ children }: { children: React.ReactNode }) => (
        <span>{children}</span>
    ),
}));

import React from 'react';
import { render, screen } from '@testing-library/react';

import { FinancialsSummary } from '../../sections/FinancialsSummary';

describe('FinancialsSummary', () => {
    it('renders nothing when bullets is empty', () => {
        const { container } = render(<FinancialsSummary bullets={[]} />);
        expect(container.innerHTML).toBe('');
    });

    it('renders the heading and bullet items', () => {
        const bullets = ['매출 성장 10%', '영업이익 감소'];
        render(<FinancialsSummary bullets={bullets} />);

        expect(
            screen.getByRole('heading', { name: /재무 분석/ })
        ).toBeInTheDocument();
        expect(screen.getByText('매출 성장 10%')).toBeInTheDocument();
        expect(screen.getByText('영업이익 감소')).toBeInTheDocument();
    });

    it('renders a list with the correct item count', () => {
        const bullets = ['A', 'B', 'C'];
        render(<FinancialsSummary bullets={bullets} />);

        const list = screen.getByRole('list', { name: /재무 분석 항목/ });
        expect(list).toBeInTheDocument();
        expect(screen.getAllByRole('listitem')).toHaveLength(bullets.length);
    });
});
