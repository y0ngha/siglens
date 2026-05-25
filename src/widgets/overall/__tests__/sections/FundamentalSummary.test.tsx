vi.mock('@/shared/ui/MarkdownText', () => ({
    MarkdownText: ({ children }: { children: React.ReactNode }) => (
        <span>{children}</span>
    ),
}));

import React from 'react';
import { render, screen } from '@testing-library/react';

import { FundamentalSummary } from '../../sections/FundamentalSummary';

describe('FundamentalSummary', () => {
    it('renders nothing when bullets is empty', () => {
        const { container } = render(<FundamentalSummary bullets={[]} />);
        expect(container.innerHTML).toBe('');
    });

    it('renders the heading and bullet items', () => {
        const bullets = ['매출 성장 10%', '영업이익 감소'];
        render(<FundamentalSummary bullets={bullets} />);

        expect(
            screen.getByRole('heading', { name: /펀더멘털 분석 요약/ })
        ).toBeInTheDocument();
        expect(screen.getByText('매출 성장 10%')).toBeInTheDocument();
        expect(screen.getByText('영업이익 감소')).toBeInTheDocument();
    });

    it('renders a list with the correct item count', () => {
        const bullets = ['A', 'B', 'C'];
        render(<FundamentalSummary bullets={bullets} />);

        const list = screen.getByRole('list', { name: /펀더멘털 분석 항목/ });
        expect(list).toBeInTheDocument();
        expect(screen.getAllByRole('listitem')).toHaveLength(bullets.length);
    });
});
