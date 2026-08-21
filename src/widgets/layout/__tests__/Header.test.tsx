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
        <span data-href={href} role="link" {...rest}>
            {children}
        </span>
    ),
}));
vi.mock('next/image', () => ({
    default: (props: Record<string, unknown>) => (
        <span
            role="img"
            aria-label={props.alt as string}
            data-src={props.src as string}
        />
    ),
}));
// LocaleSwitcher는 next-intl 컨텍스트와 로케일 라우터를 요구한다. 여기서는
// 헤더 조립만 검증하므로 stub으로 대체하고, 스위처 자체는 전용 테스트가 다룬다.
vi.mock('../LocaleSwitcher', () => ({
    LocaleSwitcher: () => <div data-testid="locale-switcher" />,
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
// Header는 이제 `HeaderSearch`(모바일 트리거 + 데스크톱 인라인 자동완성 + `ml-auto`
// 폭 계약)를 렌더한다. 이 테스트의 관심사는 헤더의 조립이지 검색 내부가 아니므로
// 같은 testid로 대체한다.
vi.mock('@/features/ticker-search', () => ({
    HeaderSearch: () => <div data-testid="ticker-search" />,
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

        expect(screen.getByLabelText('Siglens 로고')).toBeInTheDocument();
    });

    it('renders the home link', () => {
        render(<Header currentUser={null} />);

        const homeLink = screen.getByLabelText(/SIGLENS 홈/);
        expect(homeLink).toHaveAttribute('data-href', '/');
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
