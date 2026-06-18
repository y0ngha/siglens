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
import { NAV_ITEMS } from '../headerNavItems';

describe('HeaderMobileMenu', () => {
    it('renders the hamburger button with correct aria-label', () => {
        render(<HeaderMobileMenu items={NAV_ITEMS} />);

        const button = screen.getByRole('button', { name: '메뉴 열기' });
        expect(button).toBeInTheDocument();
    });

    it('hamburger button has aria-expanded="false" when closed', () => {
        render(<HeaderMobileMenu items={NAV_ITEMS} />);

        const button = screen.getByRole('button', { name: '메뉴 열기' });
        expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('drawer is hidden initially (aria-hidden=true)', () => {
        const { container } = render(<HeaderMobileMenu items={NAV_ITEMS} />);

        // The drawer is always in the DOM for SSR crawlability, but hidden via aria-hidden
        const drawer = container.querySelector('#mobile-nav-drawer');
        expect(drawer).toBeInTheDocument();
        expect(drawer).toHaveAttribute('aria-hidden', 'true');
        // Not queryable by role when aria-hidden
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('nav links are in DOM even when drawer is closed (SSR crawlability)', () => {
        render(<HeaderMobileMenu items={NAV_ITEMS} />);

        // Links should be in the DOM regardless of isOpen — for crawler discoverability
        const links = screen.getAllByRole('link', { hidden: true });
        const hrefs = links.map(l => l.getAttribute('href'));
        expect(hrefs).toContain('/market');
        expect(hrefs).toContain('/news');
        expect(hrefs).toContain('/economy');
    });

    it('nav links have aria-hidden="true" on the drawer when closed', () => {
        const { container } = render(<HeaderMobileMenu items={NAV_ITEMS} />);

        const drawer = container.querySelector('#mobile-nav-drawer');
        expect(drawer).toHaveAttribute('aria-hidden', 'true');
    });

    it('opens the drawer when hamburger is clicked', () => {
        render(<HeaderMobileMenu items={NAV_ITEMS} />);

        fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));

        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('hamburger button aria-expanded becomes true when drawer opens', () => {
        const { container } = render(<HeaderMobileMenu items={NAV_ITEMS} />);

        fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));

        // The trigger button has aria-controls — it reflects the open state
        const hamburger = container.querySelector(
            'button[aria-controls="mobile-nav-drawer"]'
        );
        expect(hamburger).toHaveAttribute('aria-expanded', 'true');
    });

    it('shows nav items in drawer when open', () => {
        render(<HeaderMobileMenu items={NAV_ITEMS} />);

        fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));

        expect(
            screen.getByRole('link', { name: /시장 분석/ })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: /마켓 뉴스/ })
        ).toBeInTheDocument();
    });

    it('nav links have correct hrefs', () => {
        render(<HeaderMobileMenu items={NAV_ITEMS} />);

        fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));

        expect(screen.getByRole('link', { name: /시장 분석/ })).toHaveAttribute(
            'href',
            '/market'
        );
        expect(screen.getByRole('link', { name: /마켓 뉴스/ })).toHaveAttribute(
            'href',
            '/news'
        );
    });

    it('applies aria-current="page" to the active link', () => {
        vi.mocked(usePathname).mockReturnValue('/market');
        render(<HeaderMobileMenu items={NAV_ITEMS} />);

        fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));

        expect(screen.getByRole('link', { name: /시장 분석/ })).toHaveAttribute(
            'aria-current',
            'page'
        );
        expect(
            screen.getByRole('link', { name: /마켓 뉴스/ })
        ).not.toHaveAttribute('aria-current');
    });

    it('applies aria-current="page" when on the /news path', () => {
        vi.mocked(usePathname).mockReturnValue('/news');
        render(<HeaderMobileMenu items={NAV_ITEMS} />);

        fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));

        expect(screen.getByRole('link', { name: /마켓 뉴스/ })).toHaveAttribute(
            'aria-current',
            'page'
        );
        expect(
            screen.getByRole('link', { name: /시장 분석/ })
        ).not.toHaveAttribute('aria-current');
    });

    it('closes the drawer when Escape key handler fires (mock callback)', () => {
        render(<HeaderMobileMenu items={NAV_ITEMS} />);

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

        render(<HeaderMobileMenu items={NAV_ITEMS} />);

        fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        act(() => {
            fireEvent.keyDown(document, { key: 'Escape' });
        });

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes the drawer when the close button inside is clicked', () => {
        render(<HeaderMobileMenu items={NAV_ITEMS} />);

        fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        // The drawer has its own X close button with distinct aria-label
        fireEvent.click(screen.getByRole('button', { name: '메뉴 패널 닫기' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('body scroll is locked while drawer is open and restored on close', () => {
        render(<HeaderMobileMenu items={NAV_ITEMS} />);

        // Initially no overflow lock
        expect(document.body.style.overflow).not.toBe('hidden');

        fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));
        expect(document.body.style.overflow).toBe('hidden');

        // Close via the internal close button
        fireEvent.click(screen.getByRole('button', { name: '메뉴 패널 닫기' }));
        expect(document.body.style.overflow).not.toBe('hidden');
    });

    it('closes the drawer when the backdrop is clicked', () => {
        render(<HeaderMobileMenu items={NAV_ITEMS} />);

        fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('mobile-nav-backdrop'));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('drawer has aria-modal="true"', () => {
        render(<HeaderMobileMenu items={NAV_ITEMS} />);

        fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));

        expect(screen.getByRole('dialog')).toHaveAttribute(
            'aria-modal',
            'true'
        );
    });

    it('hamburger button has aria-controls pointing to drawer id', () => {
        render(<HeaderMobileMenu items={NAV_ITEMS} />);

        const button = screen.getByRole('button', { name: '메뉴 열기' });
        expect(button).toHaveAttribute('aria-controls', 'mobile-nav-drawer');
    });

    it('clicking the hamburger while open CLOSES the drawer (toggle behaviour)', () => {
        render(<HeaderMobileMenu items={NAV_ITEMS} />);

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
});
