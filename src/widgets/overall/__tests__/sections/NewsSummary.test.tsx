vi.mock('@/shared/ui/MarkdownText', () => ({
    MarkdownText: ({ children }: { children: React.ReactNode }) => (
        <span>{children}</span>
    ),
}));

import React from 'react';
import { render, screen } from '@testing-library/react';

import { NewsSummary } from '../../sections/NewsSummary';

describe('NewsSummary', () => {
    it('renders nothing when bullets is empty', () => {
        const { container } = render(<NewsSummary bullets={[]} />);
        expect(container.innerHTML).toBe('');
    });

    it('renders the heading and bullet items', () => {
        const bullets = ['호재 뉴스 발표', '실적 상향 조정'];
        render(<NewsSummary bullets={bullets} />);

        expect(
            screen.getByRole('heading', { name: /뉴스 분석 요약/ })
        ).toBeInTheDocument();
        expect(screen.getByText('호재 뉴스 발표')).toBeInTheDocument();
        expect(screen.getByText('실적 상향 조정')).toBeInTheDocument();
    });

    it('renders a list with the correct item count', () => {
        const bullets = ['A', 'B'];
        render(<NewsSummary bullets={bullets} />);

        const list = screen.getByRole('list', { name: /뉴스 분석 항목/ });
        expect(list).toBeInTheDocument();
        expect(screen.getAllByRole('listitem')).toHaveLength(bullets.length);
    });
});
