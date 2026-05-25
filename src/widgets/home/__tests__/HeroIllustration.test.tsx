vi.mock('next/image', () => ({
    default: (props: Record<string, unknown>) => (
        <img
            src={props.src as string}
            alt={props.alt as string}
            width={props.width as number}
            height={props.height as number}
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
        expect(img).toHaveAttribute('src', '/hero-dashboard.svg');
    });

    it('has a descriptive alt text', () => {
        render(<HeroIllustration />);

        const img = screen.getByRole('img');
        expect(img).toHaveAttribute(
            'alt',
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
