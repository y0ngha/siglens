vi.mock('@/shared/ui/MarkdownText', () => ({
    MarkdownText: ({ children }: { children: React.ReactNode }) => (
        <span>{children}</span>
    ),
}));

import React from 'react';
import { render, screen } from '@testing-library/react';

import { TechnicalSummary } from '../../sections/TechnicalSummary';

describe('TechnicalSummary', () => {
    it('renders nothing when bullets is empty', () => {
        const { container } = render(<TechnicalSummary bullets={[]} />);
        expect(container.innerHTML).toBe('');
    });

    it('renders the heading and bullet items', () => {
        const bullets = ['RSI 과매수 구간', 'MACD 골든크로스'];
        render(<TechnicalSummary bullets={bullets} />);

        expect(
            screen.getByRole('heading', { name: /기술적 분석 요약/ })
        ).toBeInTheDocument();
        expect(screen.getByText('RSI 과매수 구간')).toBeInTheDocument();
        expect(screen.getByText('MACD 골든크로스')).toBeInTheDocument();
    });

    it('renders a list with the correct item count', () => {
        const bullets = ['A', 'B', 'C'];
        render(<TechnicalSummary bullets={bullets} />);

        const list = screen.getByRole('list', { name: /기술적 분석 항목/ });
        expect(list).toBeInTheDocument();
        expect(screen.getAllByRole('listitem')).toHaveLength(bullets.length);
    });
});
