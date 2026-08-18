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
vi.mock('@/shared/hooks/useEscapeKey', () => ({
    useEscapeKey: vi.fn(),
}));
vi.mock('@/shared/hooks/useFocusTrap', () => ({
    useFocusTrap: vi.fn(),
}));

import React, { act } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';

import { HeaderMobileMenu } from '../HeaderMobileMenu';
import { NAV_TREE } from '../headerNavTree';

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

    it('drawer is hidden initially (aria-hidden=true)', () => {
        /*
         * After the portal refactor the drawer is rendered via createPortal into
         * document.body once the component mounts. jsdom runs useEffect synchronously
         * via act(), so the drawer IS present after render — but with aria-hidden=true
         * and translate-x-full (closed state). screen.queryByRole('dialog') returns
         * null because aria-hidden suppresses the role from the accessibility tree.
         */
        render(<HeaderMobileMenu items={NAV_TREE} />);

        const drawer = document.getElementById('mobile-nav-drawer');
        expect(drawer).toBeInTheDocument();
        expect(drawer).toHaveAttribute('aria-hidden', 'true');
        // aria-hidden suppresses the role — dialog not reachable via role query
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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
         * HeaderNavStatic/HeaderNav already renders the same NAV_TREE server-side
         * for crawlers. Here we just confirm the links exist in the document (via portal)
         * so testing-library can find them even when the drawer is closed.
         */
        render(<HeaderMobileMenu items={NAV_TREE} />);

        // Links exist in document.body (via portal) — hidden: true needed because
        // the drawer has aria-hidden when closed.
        const hrefs = screen
            .getAllByRole('link', { hidden: true })
            .map(l => l.getAttribute('href'));
        // 설정에 선언된 모든 지역·카테고리 목적지가 드로어에 있어야 한다. 개수를
        // 하드코딩하면 지역을 하나 열 때마다 이 테스트만 고치게 되고, 정작 "빠진
        // 링크"는 못 잡는다.
        const expected = NAV_TREE.flatMap(v =>
            v.regions.flatMap(r => [r.href, ...r.children.map(c => c.href)])
        );
        expect(hrefs).toEqual(expected);
    });

    it('nav links have aria-hidden="true" on the drawer when closed', () => {
        render(<HeaderMobileMenu items={NAV_TREE} />);

        const drawer = document.getElementById('mobile-nav-drawer');
        expect(drawer).toHaveAttribute('aria-hidden', 'true');
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
            expect(screen.getByText(vertical.label)).toBeInTheDocument();
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

    it('closes the drawer when Escape key handler fires (mock callback)', () => {
        render(<HeaderMobileMenu items={NAV_TREE} />);

        fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        // Retrieve the close callback passed to useEscapeKey when the drawer was open
        const calls = vi.mocked(useEscapeKey).mock.calls;
        const closeCallback = calls[calls.length - 1][0];
        act(() => {
            closeCallback();
        });

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('Escape 키 DOM 이벤트가 drawer를 닫는다 (real keydown integration)', () => {
        // Simulate the real useEscapeKey behaviour: register onEscape on keydown
        // when enabled=true, remove it when enabled=false.
        let registeredHandler: ((e: KeyboardEvent) => void) | null = null;
        vi.mocked(useEscapeKey).mockImplementation(
            (onEscape: () => void, enabled: boolean) => {
                if (enabled) {
                    registeredHandler = (e: KeyboardEvent) => {
                        if (e.key === 'Escape') onEscape();
                    };
                    document.addEventListener('keydown', registeredHandler);
                } else if (registeredHandler) {
                    document.removeEventListener('keydown', registeredHandler);
                    registeredHandler = null;
                }
            }
        );

        render(<HeaderMobileMenu items={NAV_TREE} />);

        fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        act(() => {
            fireEvent.keyDown(document, { key: 'Escape' });
        });

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes the drawer when the close button inside is clicked', () => {
        render(<HeaderMobileMenu items={NAV_TREE} />);

        fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: '메뉴 패널 닫기' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
