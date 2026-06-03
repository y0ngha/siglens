import { render } from '@testing-library/react';
import { AuthFormSkeleton } from '../AuthFormSkeleton';

describe('AuthFormSkeleton', () => {
    it('renders the default number of field rows (2) plus a button row', () => {
        const { container } = render(<AuthFormSkeleton />);
        const bars = container.querySelectorAll('div.bg-secondary-800');
        expect(bars.length).toBe(5);
    });

    it('renders the requested number of field rows', () => {
        const { container } = render(<AuthFormSkeleton rows={3} />);
        const bars = container.querySelectorAll('div.bg-secondary-800');
        expect(bars.length).toBe(7);
    });

    it('is hidden from assistive tech', () => {
        const { container } = render(<AuthFormSkeleton />);
        expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
    });
});
