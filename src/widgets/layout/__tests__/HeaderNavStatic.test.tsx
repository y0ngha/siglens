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

const NAV_ITEMS = [
    { href: '/market', label: '시장 분석' },
    { href: '/news', label: '마켓 뉴스' },
] as const;

describe('HeaderNavStatic', () => {
    it('renders all nav items as links', () => {
        render(<HeaderNavStatic items={NAV_ITEMS} />);

        const marketLink = screen.getByRole('link', { name: /시장 분석/ });
        expect(marketLink).toHaveAttribute('href', '/market');

        const newsLink = screen.getByRole('link', { name: /마켓 뉴스/ });
        expect(newsLink).toHaveAttribute('href', '/news');
    });

    it('renders 2 nav items', () => {
        render(<HeaderNavStatic items={NAV_ITEMS} />);

        expect(screen.getAllByRole('link')).toHaveLength(2);
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
