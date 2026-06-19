'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    startTransition,
    useCallback,
    useEffect,
    useEffectEvent,
    useRef,
    useState,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/shared/lib/cn';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';

interface NavItem {
    readonly href: string;
    readonly label: string;
}

interface HeaderMobileMenuProps {
    readonly items: ReadonlyArray<NavItem>;
}

export function HeaderMobileMenu({ items }: HeaderMobileMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const pathname = usePathname();
    const triggerRef = useRef<HTMLButtonElement>(null);
    const drawerRef = useRef<HTMLDivElement>(null);

    const close = useCallback(() => {
        setIsOpen(false);
        triggerRef.current?.focus();
    }, []);

    const toggle = useCallback(() => setIsOpen(v => !v), []);

    useEscapeKey(close, isOpen);
    useFocusTrap(drawerRef, isOpen);

    /**
     * SSR/hydration safety gate for the portal.
     * useEffect fires only after hydration, so the first client render (with
     * mounted=false) matches the server HTML (no portal rendered) — avoiding
     * React #418 hydration mismatch. After hydration the effect flips
     * mounted=true and the portal renders normally.
     * The lazy-initializer form (`() => typeof document !== 'undefined`) would
     * set mounted=true on the first client render while the server had false,
     * causing the mismatch this pattern is designed to prevent.
     *
     * useEffectEvent makes the setState lint-safe: setState inside a useEffectEvent
     * is not tracked as an effect dependency, so the react-hooks/set-state-in-effect
     * lint rule does not fire. startTransition separately marks the mount update as
     * non-urgent (deferred paint) — it is NOT the lint fix. Canonical React 19
     * pattern (MISTAKES.md §10).
     */
    const markMounted = useEffectEvent(() => {
        startTransition(() => {
            setMounted(true);
        });
    });
    useEffect(() => {
        markMounted();
    }, []);

    // Auto-close the drawer when the pathname changes (e.g. browser back/forward
    // popstate navigation). Nav link clicks already call close() directly, but
    // history navigation bypasses that handler — leaving the drawer open with
    // body-scroll locked until the user manually dismisses it.
    // useEffectEvent escapes the lint rule: setState inside a useEffectEvent is not
    // tracked as an effect dependency, so react-hooks/set-state-in-effect does not fire.
    // startTransition separately marks the close as a non-urgent transition — it is NOT
    // the lint fix (MISTAKES.md §10).
    const closeOnNav = useEffectEvent(() => {
        startTransition(() => {
            close();
        });
    });
    useEffect(() => {
        closeOnNav();
    }, [pathname]);

    // Prevent body scroll while the drawer is open
    useEffect(() => {
        if (!isOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [isOpen]);

    /*
     * The backdrop + drawer are portaled to document.body to escape the header's
     * `backdrop-filter: blur(...)` containing block. Per CSS spec, `backdrop-filter`
     * (like `transform` and `filter`) makes the element the containing block for
     * `position: fixed` descendants — so without the portal, the fixed inset
     * coordinates (drawer `top-0 right-0`, backdrop `inset-0`) resolve against
     * the header's bounding box instead of the viewport, and the backdrop would
     * cover only the header area, not the full screen. Portaling to document.body
     * restores standard viewport-relative fixed positioning.
     *
     * Nav links remain crawlable because the desktop `HeaderNavStatic` / `HeaderNav`
     * already renders the same `NAV_ITEMS` server-side; the mobile drawer being
     * client-only does not affect discoverability.
     *
     * The drawer is always rendered (when mounted) and shown/hidden via translate-x
     * so the slide-in animation works correctly on open.
     */

    return (
        <div className="md:hidden">
            <button
                ref={triggerRef}
                type="button"
                aria-label={isOpen ? '메뉴 닫기' : '메뉴 열기'}
                aria-expanded={isOpen}
                aria-controls="mobile-nav-drawer"
                onClick={toggle}
                className="focus-visible:ring-primary-500 text-secondary-400 hover:text-secondary-100 flex h-11 w-11 touch-manipulation items-center justify-center rounded transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
                <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden="true"
                >
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
            </button>

            {mounted &&
                createPortal(
                    <>
                        {isOpen && (
                            <div
                                className="fixed inset-0 z-40 bg-black/50"
                                aria-hidden="true"
                                data-testid="mobile-nav-backdrop"
                                onClick={close}
                            />
                        )}

                        <div
                            id="mobile-nav-drawer"
                            ref={drawerRef}
                            role="dialog"
                            aria-modal={isOpen ? 'true' : undefined}
                            aria-label="메뉴"
                            aria-hidden={!isOpen}
                            tabIndex={-1}
                            className={cn(
                                'border-secondary-800 bg-secondary-900 fixed top-0 right-0 z-50 flex h-dvh w-64 flex-col border-l shadow-2xl transition-transform duration-200 outline-none motion-reduce:transition-none',
                                isOpen ? 'translate-x-0' : 'translate-x-full'
                            )}
                        >
                            <div className="border-secondary-800 flex items-center justify-end border-b px-3 py-2">
                                <button
                                    type="button"
                                    onClick={close}
                                    aria-label="메뉴 패널 닫기"
                                    tabIndex={isOpen ? undefined : -1}
                                    className="focus-visible:ring-primary-500 text-secondary-400 hover:text-secondary-100 flex h-11 w-11 touch-manipulation items-center justify-center rounded transition-colors focus-visible:ring-2 focus-visible:outline-none"
                                >
                                    <span aria-hidden="true">✕</span>
                                </button>
                            </div>

                            <nav aria-label="메뉴">
                                {items.map(item => {
                                    const isActive =
                                        pathname !== null &&
                                        (pathname === item.href ||
                                            pathname.startsWith(
                                                `${item.href}/`
                                            ));
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            aria-current={
                                                isActive ? 'page' : undefined
                                            }
                                            onClick={close}
                                            tabIndex={isOpen ? undefined : -1}
                                            className={cn(
                                                'focus-visible:ring-primary-500 flex min-h-11 w-full touch-manipulation items-center px-4 py-3 text-xs font-semibold tracking-[0.12em] uppercase transition-colors focus-visible:ring-2 focus-visible:outline-none',
                                                isActive
                                                    ? 'text-secondary-100 border-primary-500 border-l-2'
                                                    : 'text-secondary-400 hover:text-secondary-100 border-l-2 border-transparent'
                                            )}
                                        >
                                            {item.label}
                                        </Link>
                                    );
                                })}
                            </nav>
                        </div>
                    </>,
                    document.body
                )}
        </div>
    );
}
