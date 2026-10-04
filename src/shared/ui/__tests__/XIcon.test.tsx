// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { XIcon } from '@/shared/ui/XIcon';

describe('XIcon', () => {
    it('renders a single-path filled SVG that follows the text colour', () => {
        const { container } = render(<XIcon />);
        const svg = container.querySelector('svg');
        expect(svg).toBeInTheDocument();
        expect(svg).toHaveAttribute('fill', 'currentColor');
        expect(svg?.querySelectorAll('path')).toHaveLength(1);
    });

    it('is decorative: aria-hidden, the link carries the accessible name', () => {
        const { container } = render(<XIcon />);
        expect(container.querySelector('svg')).toHaveAttribute(
            'aria-hidden',
            'true'
        );
    });

    it('applies the default and a custom className', () => {
        const { container, rerender } = render(<XIcon />);
        expect(container.querySelector('svg')?.className.baseVal).toContain(
            'h-5'
        );
        rerender(<XIcon className="h-8 w-8" />);
        expect(container.querySelector('svg')?.className.baseVal).toContain(
            'h-8'
        );
    });
});
