import { render } from '@testing-library/react';
import { SectionSkeleton } from '@/views/symbol/SectionSkeleton';

describe('SectionSkeleton', () => {
    it('renders a hidden-from-AT placeholder', () => {
        const { container } = render(<SectionSkeleton />);
        const el = container.firstElementChild as HTMLElement;
        expect(el.getAttribute('aria-hidden')).toBe('true');
    });

    it('applies the pulse animation class', () => {
        const { container } = render(<SectionSkeleton />);
        const el = container.firstElementChild as HTMLElement;
        expect(el.className).toContain('animate-pulse');
    });

    it('respects reduced-motion preference', () => {
        const { container } = render(<SectionSkeleton />);
        const el = container.firstElementChild as HTMLElement;
        expect(el.className).toContain('motion-reduce:animate-none');
    });
});
