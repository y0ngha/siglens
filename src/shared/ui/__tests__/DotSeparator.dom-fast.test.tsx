import { render } from '@testing-library/react';
import { DotSeparator } from '@/shared/ui/DotSeparator';

describe('DotSeparator', () => {
    it('renders the dot character', () => {
        const { container } = render(<DotSeparator />);
        expect(container.textContent).toBe('·');
    });

    it('is aria-hidden for screen readers', () => {
        const { container } = render(<DotSeparator />);
        expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
    });

    it('renders a span element', () => {
        const { container } = render(<DotSeparator />);
        expect(container.firstChild?.nodeName).toBe('SPAN');
    });
});
