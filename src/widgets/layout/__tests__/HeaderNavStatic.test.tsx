vi.mock('next/link', () => ({
    default: ({
        href,
        children,
        ...rest
    }: {
        href: string;
        children: React.ReactNode;
        [key: string]: unknown;
    }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));

import React from 'react';
import { render, screen } from '@testing-library/react';

import { HeaderNavStatic } from '../HeaderNavStatic';
import { NAV_ITEMS } from '../headerNavItems';

describe('HeaderNavStatic', () => {
    it('renders all nav items as links', () => {
        render(<HeaderNavStatic items={NAV_ITEMS} />);

        const marketLink = screen.getByRole('link', { name: /시장 분석/ });
        expect(marketLink).toHaveAttribute('href', '/market');

        const newsLink = screen.getByRole('link', { name: /마켓 뉴스/ });
        expect(newsLink).toHaveAttribute('href', '/news');
    });

    it('renders 3 nav items', () => {
        render(<HeaderNavStatic items={NAV_ITEMS} />);

        expect(screen.getAllByRole('link')).toHaveLength(3);

        const economyLink = screen.getByRole('link', { name: /미국 경제/ });
        expect(economyLink).toHaveAttribute('href', '/economy');
    });

    it('does not set aria-current on any item (no active state)', () => {
        render(<HeaderNavStatic items={NAV_ITEMS} />);

        const links = screen.getAllByRole('link');
        links.forEach(link => {
            expect(link).not.toHaveAttribute('aria-current');
        });
    });

    it('has a navigation landmark', () => {
        render(<HeaderNavStatic items={NAV_ITEMS} />);

        expect(
            screen.getByRole('navigation', { name: /주요 네비게이션/ })
        ).toBeInTheDocument();
    });
});
