import { render } from '@testing-library/react';
import { Spinner } from '@/shared/ui/Spinner';

describe('Spinner', () => {
    it('is decorative and stops under reduced motion', () => {
        const { container } = render(<Spinner />);
        const el = container.firstElementChild!;
        expect(el).toHaveAttribute('aria-hidden', 'true');
        expect(el).toHaveClass('animate-spin', 'motion-reduce:animate-none');
    });

    it('defaults to the md primary spinner', () => {
        const { container } = render(<Spinner />);
        expect(container.firstElementChild).toHaveClass(
            'size-4',
            'border-primary-500',
            'border-t-transparent'
        );
    });

    it('maps size and tone to their classes and keeps placement classes', () => {
        const { container } = render(
            <Spinner size="xs" tone="onFill" className="shrink-0" />
        );
        expect(container.firstElementChild).toHaveClass(
            'size-2.5',
            'border-white/40',
            'border-t-white',
            'shrink-0'
        );
    });

    it.each([
        ['lg', 'size-5'],
        ['xl', 'size-8'],
    ] as const)('maps the %s size to %s', (size, cls) => {
        const { container } = render(<Spinner size={size} />);
        expect(container.firstElementChild).toHaveClass(cls);
    });
});
