vi.mock('next/link', () => ({
    default: ({
        href,
        children,
        onClick,
        ...rest
    }: {
        href: string;
        children: React.ReactNode;
        onClick?: React.MouseEventHandler;
        [key: string]: unknown;
    }) => (
        <a href={href} onClick={onClick} {...rest}>
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
// LocaleSwitcher는 next-intl 컨텍스트와 로케일 라우터를 요구한다. 여기서는
// 헤더 조립만 검증하므로 stub으로 대체하고, 스위처 자체는 전용 테스트가 다룬다.
vi.mock('../LocaleSwitcher', () => ({
    LocaleSwitcher: () => <div data-testid="locale-switcher" />,
}));
vi.mock('@/shared/hooks/useFocusTrap', () => ({
    useFocusTrap: vi.fn(),
}));

import { koMessage } from '@/shared/test-utils/koMessage';
import React, { act } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BELOW_LG_MEDIA_QUERY } from '@/shared/config/viewport';
import { usePathname } from 'next/navigation';

import { HeaderMobileMenu } from '../HeaderMobileMenu';
import { NAV_TREE } from '../utils/headerNavTree';
import { AI_SITE_URL } from '@/shared/config/aiHost';
import { localePath } from '@/shared/i18n/locales';

/** 같은 라벨(`미국`)이 버티컬마다 반복되므로 href 집합으로 확인한다. */
function hrefsOf(label: string): string[] {
    return screen
        .getAllByRole('link', { name: label })
        .map(link => link.getAttribute('href') ?? '');
}

function linkByHref(href: string): HTMLElement {
    const found = screen
        .getAllByRole('link')
        .find(link => link.getAttribute('href') === href);
    if (!found) throw new Error(`no drawer link for ${href}`);
    return found;
}

/** 닫힌 드로어는 DOM에 남되 `inert`다 — 접근성 트리·탭 순서에서 모두 빠진다. */
function expectDrawerClosed() {
    expect(document.getElementById('mobile-nav-drawer')).toHaveAttribute(
        'inert'
    );
}

describe('HeaderMobileMenu', () => {
    it('renders the hamburger button with correct aria-label', () => {
        render(<HeaderMobileMenu items={NAV_TREE} />);

        const button = screen.getByRole('button', { name: '메뉴 열기' });
        expect(button).toBeInTheDocument();
    });

    it('hamburger button has aria-expanded="false" when closed', () => {
        render(<HeaderMobileMenu items={NAV_TREE} />);

        const button = screen.getByRole('button', { name: '메뉴 열기' });
        expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('drawer is rendered but inert initially', () => {
        render(<HeaderMobileMenu items={NAV_TREE} />);

        expect(
            document.getElementById('mobile-nav-drawer')
        ).toBeInTheDocument();
        expectDrawerClosed();
    });

    it('drawer is portaled into document.body', () => {
        /*
         * Verifies the portal escapes the header's backdrop-filter containing block:
         * the drawer's direct parent must be document.body, not the component's
         * wrapper div.
         */
        render(<HeaderMobileMenu items={NAV_TREE} />);

        const drawer = document.getElementById('mobile-nav-drawer')!;
        expect(drawer).toBeInTheDocument();
        expect(drawer.parentElement).toBe(document.body);
    });

    it('backdrop is portaled into document.body when open', () => {
        render(<HeaderMobileMenu items={NAV_TREE} />);

        fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));

        const backdrop = screen.getByTestId('mobile-nav-backdrop');
        expect(backdrop.parentElement).toBe(document.body);
    });

    it('nav links are accessible via document when drawer is closed', () => {
        /*
         * After the portal refactor the drawer is client-rendered. The desktop
         * HeaderNav already renders the same NAV_TREE server-side
         * for crawlers. Here we just confirm the links exist in the document (via portal)
         * so testing-library can find them even when the drawer is closed.
         */
        render(<HeaderMobileMenu items={NAV_TREE} />);

        // Links exist in document.body (via portal) — hidden: true needed because
        // the closed drawer is inert.
        const hrefs = screen
            .getAllByRole('link', { hidden: true })
            .map(l => l.getAttribute('href'));
        // 설정에 선언된 모든 지역·카테고리 목적지가 드로어에 있어야 한다. 개수를
        // 하드코딩하면 지역을 하나 열 때마다 이 테스트만 고치게 되고, 정작 "빠진
        // 링크"는 못 잡는다.
        const expected = NAV_TREE.flatMap(v => [
            // 버티컬 자체가 지역과 별개의 상위 페이지를 가지면(뉴스 허브) 그것도 건다.
            ...(v.overview ? [v.overview.href] : []),
            ...v.regions.flatMap(r => [r.href, ...r.children.map(c => c.href)]),
        ]);
        // 차트 가이드 → SIGLENS AI 진입점 순서로 내비 목록 바로 다음, showAuthCta보다 앞이다.
        expected.push('/guide');
        expected.push(`${AI_SITE_URL}${localePath('ko', '/')}`);
        expect(hrefs).toEqual(expected);
    });

    it('renders the SIGLENS AI entry point below the nav list', () => {
        render(<HeaderMobileMenu items={NAV_TREE} />);

        expect(
            screen.getByRole('link', { name: '시그렌즈 AI Beta', hidden: true })
        ).toBeInTheDocument();
    });

    it('opens the drawer when hamburger is clicked', () => {
        render(<HeaderMobileMenu items={NAV_TREE} />);

        fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));

        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('hamburger button aria-expanded becomes true when drawer opens', () => {
        const { container } = render(<HeaderMobileMenu items={NAV_TREE} />);

        fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));

        const hamburger = container.querySelector(
            'button[aria-controls="mobile-nav-drawer"]'
        );
        expect(hamburger).toHaveAttribute('aria-expanded', 'true');
    });

    it('renders every vertical as a section heading with its region links', () => {
        // 데스크톱은 드롭다운이지만 드로어는 펼친 채로 둔다 — 좁은 화면에서 2단
        // 접힘 메뉴는 목적지 하나에 탭 두 번을 요구한다.
        render(<HeaderMobileMenu items={NAV_TREE} />);

        fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));

        for (const vertical of NAV_TREE) {
            expect(
                screen.getByText(koMessage(vertical.labelKey))
            ).toBeInTheDocument();
        }
        expect(hrefsOf('미국')).toContain('/market');
        expect(hrefsOf('한국')).toContain('/market/kr');
        expect(hrefsOf('암호화폐')).toContain('/news/crypto');
    });

    it('renders the second-level news categories too', () => {
        render(<HeaderMobileMenu items={NAV_TREE} />);

        fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));

        expect(hrefsOf('미국 주식')).toContain('/news/stock');
    });

    it('applies aria-current="page" only to the exact active link', () => {
        vi.mocked(usePathname).mockReturnValue('/market');
        render(<HeaderMobileMenu items={NAV_TREE} />);

        fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));

        expect(linkByHref('/market')).toHaveAttribute('aria-current', 'page');
        // `/market`은 `/market/kr`의 접두사다 — 접두사 매칭이면 둘 다 활성이 된다.
        expect(linkByHref('/market/kr')).not.toHaveAttribute('aria-current');
    });

    it('applies aria-current="page" when on a news category path', () => {
        vi.mocked(usePathname).mockReturnValue('/news/crypto');
        render(<HeaderMobileMenu items={NAV_TREE} />);

        fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));

        expect(linkByHref('/news/crypto')).toHaveAttribute(
            'aria-current',
            'page'
        );
        expect(linkByHref('/market')).not.toHaveAttribute('aria-current');
    });

    it('Escape 키로 열린 드로어를 닫고 포커스를 햄버거로 돌려준다', () => {
        render(<HeaderMobileMenu items={NAV_TREE} />);
        const hamburger = screen.getByRole('button', { name: '메뉴 열기' });
        fireEvent.click(hamburger);
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        act(() => {
            fireEvent.keyDown(document, { key: 'Escape' });
        });

        expectDrawerClosed();
        expect(screen.getByRole('button', { name: '메뉴 열기' })).toHaveFocus();
    });

    describe('닫힌 드로어는', () => {
        it('inert라 내용물이 탭 순서와 보조 기술에서 빠진다', () => {
            render(<HeaderMobileMenu items={NAV_TREE} />);

            expect(
                document.getElementById('mobile-nav-drawer')
            ).toHaveAttribute('inert');
        });

        it('링크·버튼에 개별 tabindex를 달지 않는다', () => {
            render(<HeaderMobileMenu items={NAV_TREE} showAuthCta />);

            const drawer = document.getElementById('mobile-nav-drawer')!;
            const focusables = drawer.querySelectorAll('a, button');
            expect(focusables.length).toBeGreaterThan(0);
            for (const el of focusables) {
                expect(el).not.toHaveAttribute('tabindex');
            }
        });

        it('열리면 inert가 풀린다', () => {
            render(<HeaderMobileMenu items={NAV_TREE} />);

            fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));

            expect(
                document.getElementById('mobile-nav-drawer')
            ).not.toHaveAttribute('inert');
        });
    });

    describe('데스크톱 폭(lg 이상)으로 넘어가면', () => {
        const originalMatchMedia = window.matchMedia;
        const listeners = new Set<(event: MediaQueryListEvent) => void>();

        beforeEach(() => {
            listeners.clear();
            window.matchMedia = ((query: string) => ({
                matches: query === BELOW_LG_MEDIA_QUERY,
                media: query,
                addEventListener: (
                    _type: string,
                    fn: (event: MediaQueryListEvent) => void
                ) => listeners.add(fn),
                removeEventListener: (
                    _type: string,
                    fn: (event: MediaQueryListEvent) => void
                ) => listeners.delete(fn),
            })) as unknown as typeof window.matchMedia;
        });

        afterEach(() => {
            window.matchMedia = originalMatchMedia;
        });

        const crossToDesktop = () =>
            act(() => {
                for (const fn of listeners)
                    fn({ matches: false } as MediaQueryListEvent);
            });

        it('열린 드로어와 백드롭이 닫히고 스크롤 잠금이 풀린다', () => {
            render(<HeaderMobileMenu items={NAV_TREE} />);
            fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));
            expect(document.body.style.overflow).toBe('hidden');

            crossToDesktop();

            expectDrawerClosed();
            expect(
                screen.queryByTestId('mobile-nav-backdrop')
            ).not.toBeInTheDocument();
            expect(document.body.style.overflow).not.toBe('hidden');
        });

        it('숨겨지는 햄버거로 포커스를 되돌리지 않는다', () => {
            render(<HeaderMobileMenu items={NAV_TREE} />);
            fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));

            crossToDesktop();

            expect(
                screen.getByRole('button', { name: '메뉴 열기' })
            ).not.toHaveFocus();
        });

        it('여전히 lg 미만이면 열린 채 유지된다', () => {
            render(<HeaderMobileMenu items={NAV_TREE} />);
            fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));

            act(() => {
                for (const fn of listeners)
                    fn({ matches: true } as MediaQueryListEvent);
            });

            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        it('백드롭과 드로어 자체에도 lg:hidden이 걸려 있다', () => {
            render(<HeaderMobileMenu items={NAV_TREE} />);
            fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));

            expect(screen.getByTestId('mobile-nav-backdrop')).toHaveClass(
                'lg:hidden'
            );
            expect(screen.getByRole('dialog')).toHaveClass('lg:hidden');
        });
    });

    it('closes the drawer when the close button inside is clicked', () => {
        render(<HeaderMobileMenu items={NAV_TREE} />);

        fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: '메뉴 패널 닫기' }));
        expectDrawerClosed();
    });

    it('body scroll is locked while drawer is open and restored on close', () => {
        render(<HeaderMobileMenu items={NAV_TREE} />);

        // Initially no overflow lock
        expect(document.body.style.overflow).not.toBe('hidden');

        fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));
        expect(document.body.style.overflow).toBe('hidden');

        // Close via the internal close button
        fireEvent.click(screen.getByRole('button', { name: '메뉴 패널 닫기' }));
        expect(document.body.style.overflow).not.toBe('hidden');
    });

    it('closes the drawer when the backdrop is clicked', () => {
        render(<HeaderMobileMenu items={NAV_TREE} />);

        fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('mobile-nav-backdrop'));

        expectDrawerClosed();
    });

    it('drawer has aria-modal="true"', () => {
        render(<HeaderMobileMenu items={NAV_TREE} />);

        fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));

        expect(screen.getByRole('dialog')).toHaveAttribute(
            'aria-modal',
            'true'
        );
    });

    it('hamburger button has aria-controls pointing to drawer id', () => {
        render(<HeaderMobileMenu items={NAV_TREE} />);

        const button = screen.getByRole('button', { name: '메뉴 열기' });
        expect(button).toHaveAttribute('aria-controls', 'mobile-nav-drawer');
    });

    it('clicking the hamburger while open CLOSES the drawer (toggle behaviour)', () => {
        render(<HeaderMobileMenu items={NAV_TREE} />);

        // Open the drawer first
        fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        // Click the hamburger again (now labelled 메뉴 닫기) — should close
        fireEvent.click(screen.getByRole('button', { name: '메뉴 닫기' }));

        // Drawer should be hidden again — and the SAME trigger reverts to the
        // "메뉴 열기" label with aria-expanded=false (resolves only when closed,
        // so the assertion genuinely depends on the toggle having closed it).
        expectDrawerClosed();
        expect(
            screen.getByRole('button', { name: '메뉴 열기' })
        ).toHaveAttribute('aria-expanded', 'false');
    });

    it('pathname이 변경되면 열린 드로어를 자동으로 닫는다', () => {
        vi.mocked(usePathname).mockReturnValue('/');
        const { rerender } = render(<HeaderMobileMenu items={NAV_TREE} />);

        fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        // Simulate navigation: usePathname returns a new value → rerender triggers
        // the pathname useEffect → closeOnNav runs → drawer closes.
        // The isOpen guard in closeOnNav lets the effect fire because the drawer IS
        // open at this point (no spurious no-op on mount concern here).
        vi.mocked(usePathname).mockReturnValue('/news');
        rerender(<HeaderMobileMenu items={NAV_TREE} />);

        expectDrawerClosed();
    });

    describe('auth CTA + authNext', () => {
        it('without authNext the drawer login/signup hrefs are plain', () => {
            render(<HeaderMobileMenu items={NAV_TREE} showAuthCta />);
            fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));
            expect(linkByHref('/login')).toBeInTheDocument();
            expect(linkByHref('/signup')).toBeInTheDocument();
        });

        it('with authNext both drawer auth links carry the encoded ?next=', () => {
            render(
                <HeaderMobileMenu
                    items={NAV_TREE}
                    showAuthCta
                    authNext="/api/auth/handoff?to=ai&next=%2F"
                />
            );
            fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));
            const q = '?next=%2Fapi%2Fauth%2Fhandoff%3Fto%3Dai%26next%3D%252F';
            expect(linkByHref(`/login${q}`)).toBeInTheDocument();
            expect(linkByHref(`/signup${q}`)).toBeInTheDocument();
        });
    });
});
