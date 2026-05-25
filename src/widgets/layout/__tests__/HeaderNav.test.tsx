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
vi.mock('next/navigation', () => ({
    usePathname: vi.fn(() => '/market'),
}));
vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) =>
        args
            .flat()
            .filter(a => typeof a === 'string' && a.length > 0)
            .join(' '),
}));

import React from 'react';
import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';

import { HeaderNav } from '../HeaderNav';

const NAV_ITEMS = [
    { href: '/market', label: '시장 분석' },
    { href: '/about', label: '소개' },
] as const;

describe('HeaderNav', () => {
    it('renders all nav items', () => {
        render(<HeaderNav items={NAV_ITEMS} />);

        expect(
            screen.getByRole('link', { name: /시장 분석/ })
        ).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /소개/ })).toBeInTheDocument();
    });

    it('sets aria-current="page" on the active item', () => {
        render(<HeaderNav items={NAV_ITEMS} />);

        const activeLink = screen.getByRole('link', { name: /시장 분석/ });
        expect(activeLink).toHaveAttribute('aria-current', 'page');
    });

    it('does not set aria-current on inactive items', () => {
        render(<HeaderNav items={NAV_ITEMS} />);

        const inactiveLink = screen.getByRole('link', { name: /소개/ });
        expect(inactiveLink).not.toHaveAttribute('aria-current');
    });

    it('matches sub-paths for active state', () => {
        vi.mocked(usePathname).mockReturnValue('/market/detail');

        render(<HeaderNav items={NAV_ITEMS} />);

        const activeLink = screen.getByRole('link', { name: /시장 분석/ });
        expect(activeLink).toHaveAttribute('aria-current', 'page');
    });

    it('has a navigation landmark', () => {
        render(<HeaderNav items={NAV_ITEMS} />);

        expect(
            screen.getByRole('navigation', { name: /주요 네비게이션/ })
        ).toBeInTheDocument();
    });
});
