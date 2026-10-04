import { render, screen } from '@testing-library/react';
import {
    SymbolTabsSkeleton,
    SKELETON_PILL_COUNT,
} from '@/views/symbol/SymbolTabsSkeleton';

describe('SymbolTabsSkeleton', () => {
    it('renders a nav element with aria-hidden', () => {
        render(<SymbolTabsSkeleton />);
        const nav = screen.getByRole('navigation', { hidden: true });
        expect(nav.getAttribute('aria-hidden')).toBe('true');
    });

    it('renders placeholder pill spans without text labels (no equity copy flash)', () => {
        const { container } = render(<SymbolTabsSkeleton />);
        // No label text should be rendered — placeholder pills are empty.
        expect(container.textContent).toBe('');
    });

    it('renders spans (not links) as placeholder pills', () => {
        const { container } = render(<SymbolTabsSkeleton />);
        const links = container.querySelectorAll('a');
        expect(links).toHaveLength(0);

        const spans = container.querySelectorAll('span');
        expect(spans.length).toBe(SKELETON_PILL_COUNT);
    });
});
