import { render } from '@testing-library/react';
import { GearIcon } from '@/shared/ui/GearIcon';

describe('GearIcon', () => {
    it('renders an SVG', () => {
        const { container } = render(<GearIcon />);
        const svg = container.querySelector('svg');
        expect(svg).toBeInTheDocument();
    });

    it('is aria-hidden', () => {
        const { container } = render(<GearIcon />);
        const svg = container.querySelector('svg');
        expect(svg).toHaveAttribute('aria-hidden');
    });

    it('applies default className', () => {
        const { container } = render(<GearIcon />);
        const svg = container.querySelector('svg');
        expect(svg?.className.baseVal).toContain('h-5');
    });

    it('applies custom className', () => {
        const { container } = render(<GearIcon className="h-8 w-8" />);
        const svg = container.querySelector('svg');
        expect(svg?.className.baseVal).toContain('h-8');
    });
});
