// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { VelogIcon } from '@/shared/ui/VelogIcon';

describe('VelogIcon', () => {
    it('renders a single-path filled SVG that follows the text colour', () => {
        const { container } = render(<VelogIcon />);
        const svg = container.querySelector('svg');
        expect(svg).toHaveAttribute('fill', 'currentColor');
        expect(svg?.querySelectorAll('path')).toHaveLength(1);
    });

    it('is decorative: aria-hidden, the link carries the accessible name', () => {
        const { container } = render(<VelogIcon />);
        expect(container.querySelector('svg')).toHaveAttribute(
            'aria-hidden',
            'true'
        );
    });
});
