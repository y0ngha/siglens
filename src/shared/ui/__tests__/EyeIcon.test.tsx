import { render } from '@testing-library/react';
import { EyeIcon } from '@/shared/ui/EyeIcon';

describe('EyeIcon', () => {
    it('renders an SVG when isVisible is true', () => {
        const { container } = render(<EyeIcon isVisible={true} />);
        const svg = container.querySelector('svg');
        expect(svg).toBeInTheDocument();
    });

    it('renders an SVG when isVisible is false', () => {
        const { container } = render(<EyeIcon isVisible={false} />);
        const svg = container.querySelector('svg');
        expect(svg).toBeInTheDocument();
    });

    it('renders different SVGs for visible vs hidden state', () => {
        const { container: visibleContainer } = render(
            <EyeIcon isVisible={true} />
        );
        const { container: hiddenContainer } = render(
            <EyeIcon isVisible={false} />
        );
        const visiblePaths = visibleContainer.querySelectorAll('path');
        const hiddenPaths = hiddenContainer.querySelectorAll('path');
        // The visible icon has 2 paths, the hidden icon has 2 paths with different d attributes
        expect(visiblePaths[0]?.getAttribute('d')).not.toBe(
            hiddenPaths[0]?.getAttribute('d')
        );
    });

    it('is aria-hidden', () => {
        const { container } = render(<EyeIcon isVisible={true} />);
        const svg = container.querySelector('svg');
        expect(svg).toHaveAttribute('aria-hidden');
    });

    it('applies default className', () => {
        const { container } = render(<EyeIcon isVisible={true} />);
        const svg = container.querySelector('svg');
        expect(svg?.className.baseVal).toContain('h-3.5');
    });

    it('applies custom className', () => {
        const { container } = render(
            <EyeIcon isVisible={true} className="h-5 w-5" />
        );
        const svg = container.querySelector('svg');
        expect(svg?.className.baseVal).toContain('h-5');
    });
});
