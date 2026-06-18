'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
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

    // Prevent body scroll while the drawer is open
    useEffect(() => {
        if (!isOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [isOpen]);

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

            {/* Backdrop — only visible when open */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50"
                    aria-hidden="true"
                    data-testid="mobile-nav-backdrop"
                    onClick={close}
                />
            )}

            {/*
             * Drawer is always in the DOM so crawlers see the nav links in SSR HTML.
             * Visibility is controlled via translate-x: closed = off-screen (translate-x-full),
             * open = on-screen (translate-x-0). aria-hidden hides from AT when closed;
             * tabIndex=-1 on links prevents keyboard reach when closed.
             */}
            <div
                id="mobile-nav-drawer"
                ref={drawerRef}
                role="dialog"
                aria-modal={isOpen ? 'true' : undefined}
                aria-label="메뉴"
                aria-hidden={!isOpen}
                tabIndex={-1}
                className={cn(
                    'border-secondary-800 bg-secondary-900 fixed top-0 right-0 z-50 flex h-full w-64 flex-col border-l transition-transform duration-200 outline-none motion-reduce:transition-none',
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
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            aria-hidden="true"
                        >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <nav aria-label="메뉴">
                    {items.map(item => {
                        const isActive =
                            pathname !== null &&
                            (pathname === item.href ||
                                pathname.startsWith(`${item.href}/`));
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={isActive ? 'page' : undefined}
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
        </div>
    );
}
