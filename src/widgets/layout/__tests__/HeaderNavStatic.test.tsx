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

const NAV_ITEMS = [{ href: '/market', label: '시장 분석' }] as const;

describe('HeaderNavStatic', () => {
    it('renders all nav items as links', () => {
        render(<HeaderNavStatic items={NAV_ITEMS} />);

        const link = screen.getByRole('link', { name: /시장 분석/ });
        expect(link).toHaveAttribute('href', '/market');
    });

    it('does not set aria-current on any item (no active state)', () => {
        render(<HeaderNavStatic items={NAV_ITEMS} />);

        const link = screen.getByRole('link', { name: /시장 분석/ });
        expect(link).not.toHaveAttribute('aria-current');
    });

    it('has a navigation landmark', () => {
        render(<HeaderNavStatic items={NAV_ITEMS} />);

        expect(
            screen.getByRole('navigation', { name: /주요 네비게이션/ })
        ).toBeInTheDocument();
    });
});
