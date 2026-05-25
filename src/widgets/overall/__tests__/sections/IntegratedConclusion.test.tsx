vi.mock('@/shared/ui/MarkdownText', () => ({
    MarkdownText: ({ children }: { children: React.ReactNode }) => (
        <span>{children}</span>
    ),
}));

import React from 'react';
import { render, screen } from '@testing-library/react';

import { IntegratedConclusion } from '../../sections/IntegratedConclusion';

describe('IntegratedConclusion', () => {
    it('renders nothing when text is empty', () => {
        const { container } = render(<IntegratedConclusion text="" />);
        expect(container.innerHTML).toBe('');
    });

    it('renders the heading and markdown text', () => {
        render(<IntegratedConclusion text="전반적으로 강세 전망" />);

        expect(
            screen.getByRole('heading', { name: /통합 결론/ })
        ).toBeInTheDocument();
        expect(screen.getByText('전반적으로 강세 전망')).toBeInTheDocument();
    });

    it('has a primary-tone border section', () => {
        render(<IntegratedConclusion text="결론 내용" />);

        const section = screen.getByRole('region', { name: /통합 결론/ });
        expect(section).toHaveClass('border-primary-500/30');
    });
});
