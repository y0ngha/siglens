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
vi.mock('next/image', () => ({
    default: (props: Record<string, unknown>) => (
        <img src={props.src as string} alt={props.alt as string} />
    ),
}));
vi.mock('../HeaderNav', () => ({
    HeaderNav: () => <nav data-testid="header-nav" />,
}));
vi.mock('../HeaderNavStatic', () => ({
    HeaderNavStatic: () => <nav data-testid="header-nav-static" />,
}));
vi.mock('../HeaderUserMenu', () => ({
    HeaderUserMenu: () => <div data-testid="user-menu" />,
}));
vi.mock('@/features/ticker-search', () => ({
    TickerAutocomplete: () => <div data-testid="ticker-search" />,
}));
vi.mock('@/shared/lib/seo', () => ({
    SITE_NAME: 'Siglens',
}));

import React from 'react';
import { render, screen } from '@testing-library/react';

import { Header } from '../Header';

describe('Header', () => {
    it('renders the site logo and name', () => {
        render(<Header currentUser={null} />);

        expect(screen.getByAltText('Siglens 로고')).toBeInTheDocument();
    });

    it('renders the home link', () => {
        render(<Header currentUser={null} />);

        const homeLink = screen.getByLabelText(/SIGLENS 홈/);
        expect(homeLink).toHaveAttribute('href', '/');
    });

    it('renders ticker search and user menu', () => {
        render(<Header currentUser={null} />);

        expect(screen.getByTestId('ticker-search')).toBeInTheDocument();
        expect(screen.getByTestId('user-menu')).toBeInTheDocument();
    });

    it('renders as a banner landmark', () => {
        render(<Header currentUser={null} />);

        expect(screen.getByRole('banner')).toBeInTheDocument();
    });
});
