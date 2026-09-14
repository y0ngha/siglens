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
import { LocaleProvider } from '@/shared/i18n/LocaleContext';
import { AI_SITE_URL } from '@/shared/config/aiHost';

describe('Header', () => {
    it('renders the site logo and name', () => {
        render(<Header currentUser={null} />);

        expect(screen.getByLabelText('SIGLENS 로고')).toBeInTheDocument();
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

    /** 언어 전환 수단을 연다(`LOCALE_SWITCHER_VISIBLE`) — 플래그를 꺼도 이 테스트가 잡는다. */
    it('renders the locale switcher in the header', () => {
        render(<Header currentUser={null} />);

        expect(screen.getAllByTestId('locale-switcher').length).toBeGreaterThan(
            0
        );
    });

    it('renders as a banner landmark', () => {
        render(<Header currentUser={null} />);

        expect(screen.getByRole('banner')).toBeInTheDocument();
    });

    it('forwards authNext to the mobile drawer auth CTA login href', () => {
        // HeaderUserMenu is stubbed above, so the SSO handoff pass-through is
        // observed via HeaderMobileMenu (not mocked in this file) instead.
        render(
            <Header
                currentUser={null}
                authNext="/api/auth/handoff?to=ai&next=%2F"
            />
        );

        // `next/link` is mocked above to a `<span data-href>` (not a real `href`
        // attribute) — mirrors the pattern the other assertions in this file use.
        const loginLink = screen
            .getAllByRole('link', { hidden: true })
            .find(l =>
                (l.getAttribute('data-href') ?? '').startsWith('/login?next=')
            );
        expect(loginLink).toHaveAttribute(
            'data-href',
            '/login?next=%2Fapi%2Fauth%2Fhandoff%3Fto%3Dai%26next%3D%252F'
        );
    });

    describe('SIGLENS AI logo lockup', () => {
        it('main host: the AI wordmark next to the logo links to the AI product; the logo goes home', () => {
            render(<Header currentUser={null} />);
            const ai = screen.getByRole('link', { name: 'SIGLENS AI Beta' });
            expect(ai).toHaveTextContent(/^AIBeta$/);
            expect(ai).toHaveAttribute('href', `${AI_SITE_URL}/`);
            expect(ai).not.toHaveAttribute('aria-current');
            const logo = screen.getByTitle('홈으로');
            expect(
                logo.getAttribute('data-href') ?? logo.getAttribute('href')
            ).toBe('/');
            expect(logo).toHaveAttribute('aria-label', 'SIGLENS 홈');
            // No duplicate entry in the desktop nav: the lockup is the entry point.
            expect(
                screen.getAllByRole('link', { name: 'SIGLENS AI Beta' })
            ).toHaveLength(1);
        });

        it('ai host: the AI wordmark is the current page and the logo goes back to siglens.io', () => {
            render(
                <LocaleProvider locale="ko" hrefBase="https://siglens.io">
                    <Header currentUser={null} />
                </LocaleProvider>
            );
            expect(
                screen.getByRole('link', { name: 'SIGLENS AI Beta' })
            ).toHaveAttribute('aria-current', 'page');
            const logo = screen.getByTitle('홈으로');
            expect(
                logo.getAttribute('data-href') ?? logo.getAttribute('href')
            ).toBe('https://siglens.io/');
            expect(logo).toHaveAttribute('aria-label', 'SIGLENS 홈');
            expect(screen.getByText('Siglens').className).toMatch(/\binline\b/);
        });
    });
});
