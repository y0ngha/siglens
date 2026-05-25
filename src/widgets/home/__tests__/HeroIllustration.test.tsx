vi.mock('next/image', () => ({
    default: (props: Record<string, unknown>) => (
        <span
            role="img"
            data-src={props.src as string}
            aria-label={props.alt as string}
            data-width={props.width as number}
            data-height={props.height as number}
            className={props.className as string}
            data-priority={String(props.priority)}
            data-fetch-priority={props.fetchPriority as string}
        />
    ),
}));

import { render, screen } from '@testing-library/react';

import { HeroIllustration } from '../HeroIllustration';

describe('HeroIllustration', () => {
    it('renders an image with the correct src', () => {
        render(<HeroIllustration />);

        const img = screen.getByRole('img');
        expect(img).toHaveAttribute('data-src', '/hero-dashboard.svg');
    });

    it('has a descriptive alt text', () => {
        render(<HeroIllustration />);

        const img = screen.getByRole('img');
        expect(img).toHaveAttribute(
            'aria-label',
            expect.stringContaining('캔들 차트')
        );
    });

    it('uses priority and fetchPriority for LCP optimization', () => {
        render(<HeroIllustration />);

        const img = screen.getByRole('img');
        expect(img).toHaveAttribute('data-priority', 'true');
        expect(img).toHaveAttribute('data-fetch-priority', 'high');
    });

    it('applies the passed className', () => {
        render(<HeroIllustration className="custom-class" />);

        const img = screen.getByRole('img');
        expect(img).toHaveClass('custom-class');
    });
});
