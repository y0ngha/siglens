import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mockUseHideOnScrollDown = vi.fn();
vi.mock('@/widgets/layout', () => ({
    useHideOnScrollDown: () => mockUseHideOnScrollDown(),
}));

import { AboutCtaBar } from '../AboutCtaBar';

describe('AboutCtaBar', () => {
    it('renders the title and links the cta to the given href', () => {
        mockUseHideOnScrollDown.mockReturnValue(false);
        render(<AboutCtaBar title="Ask now" cta="Ask" href="/en" />);
        expect(screen.getByText('Ask now')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Ask' })).toHaveAttribute(
            'href',
            '/en'
        );
    });

    it('slides up on phones when the header is hidden', () => {
        mockUseHideOnScrollDown.mockReturnValue(true);
        const { container } = render(
            <AboutCtaBar title="Ask now" cta="Ask" href="/en" />
        );
        expect(container.firstElementChild).toHaveClass(
            'max-lg:-translate-y-14'
        );
    });

    it('does not slide up while the header is shown', () => {
        mockUseHideOnScrollDown.mockReturnValue(false);
        const { container } = render(
            <AboutCtaBar title="Ask now" cta="Ask" href="/en" />
        );
        expect(container.firstElementChild).not.toHaveClass(
            'max-lg:-translate-y-14'
        );
    });
});
