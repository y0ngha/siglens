vi.mock('@/shared/ui/MarkdownText', () => ({
    MarkdownText: ({ children }: { children: React.ReactNode }) => (
        <span>{children}</span>
    ),
}));

import React from 'react';
import { render, screen } from '@testing-library/react';

import { OverallSummary } from '../../sections/OverallSummary';

describe('OverallSummary', () => {
    it('renders nothing when headline is empty', () => {
        const { container } = render(<OverallSummary headline="" />);
        expect(container.innerHTML).toBe('');
    });

    it('renders the heading and headline text', () => {
        render(<OverallSummary headline="강세 전환 시그널 포착" />);

        expect(
            screen.getByRole('heading', { name: /종합 요약/ })
        ).toBeInTheDocument();
        expect(screen.getByText('강세 전환 시그널 포착')).toBeInTheDocument();
    });
});
