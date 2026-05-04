'use client';

import { LogoutButton } from '@/components/auth/LogoutButton';
import { useEscapeKey } from '@/components/hooks/useEscapeKey';
import { usePopoverToggle } from '@/components/hooks/usePopoverToggle';
import { TIER_LABEL } from '@/lib/auth/tierLabel';
import { cn } from '@/lib/cn';
import type { Tier } from '@y0ngha/siglens-core';
import Link from 'next/link';
import { useRef } from 'react';

const TIER_DOT_COLOR: Record<Tier, string> = {
    free: 'bg-secondary-500',
    member: 'bg-primary-500',
    pro: 'bg-ui-warning',
};

/** Minimal serializable user shape passed across the RSC boundary; decoupled from `AuthUserRecord` to avoid shipping Date fields the menu doesn't read. */
export interface HeaderUserMenuUser {
    readonly email: string;
    readonly name: string | null;
    readonly tier: Tier;
}

interface HeaderUserMenuProps {
    /** Current user; null when guest. Fetched server-side in Header. */
    readonly currentUser: HeaderUserMenuUser | null;
    /**
     * When true, renders a skeleton placeholder instead of login/signup buttons.
     * Set by the Suspense fallback when a session cookie exists, signalling that
     * the user is likely logged in while the DB lookup is still in flight.
     */
    readonly loading?: boolean;
}

function getInitial(user: HeaderUserMenuUser): string {
    const source = user.name && user.name.length > 0 ? user.name : user.email;
    return source.charAt(0).toUpperCase();
}

export function HeaderUserMenu({ currentUser, loading }: HeaderUserMenuProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const { isOpen, close, toggle } = usePopoverToggle(containerRef);
    useEscapeKey(close, isOpen);

    if (loading) {
        return (
            <div
                className="bg-secondary-800 size-10 animate-pulse rounded-full"
                aria-hidden
            />
        );
    }

    if (!currentUser) {
        return (
            <nav aria-label="인증" className="flex items-center gap-2">
                <Link
                    href="/login"
                    className="text-secondary-200 hover:text-secondary-50 focus-visible:ring-primary-500 hidden min-h-11 items-center rounded px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none sm:inline-flex"
                >
                    로그인
                </Link>
                <Link
                    href="/signup"
                    className="bg-primary-600 hover:bg-primary-700 focus-visible:ring-primary-500 inline-flex min-h-11 items-center rounded px-3 text-sm font-semibold text-white transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                    회원가입
                </Link>
            </nav>
        );
    }

    const initial = getInitial(currentUser);
    const tierColor = TIER_DOT_COLOR[currentUser.tier];
    const tierLabel = TIER_LABEL[currentUser.tier];
    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={toggle}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                aria-label={`사용자 메뉴 (${tierLabel})`}
                className="bg-secondary-800 text-secondary-100 hover:bg-secondary-700 focus-visible:ring-primary-500 relative flex size-10 items-center justify-center rounded-full text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
                <span aria-hidden>{initial}</span>
                <span
                    aria-hidden
                    className={cn(
                        'ring-secondary-900 absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2',
                        tierColor
                    )}
                />
            </button>
            {isOpen ? (
                <div
                    role="menu"
                    aria-label="사용자 메뉴"
                    className="border-secondary-800 bg-secondary-900 absolute right-0 z-50 mt-2 w-64 rounded-lg border p-2 shadow-2xl"
                >
                    <div className="border-secondary-800 border-b px-3 py-2 text-sm">
                        <p className="text-secondary-50 font-semibold">
                            {currentUser.name ?? currentUser.email}
                        </p>
                        {currentUser.name ? (
                            <p className="text-secondary-400 text-xs">
                                {currentUser.email}
                            </p>
                        ) : null}
                        <p className="text-secondary-400 mt-1 flex items-center gap-1.5 text-xs">
                            <span
                                aria-hidden
                                className={cn(
                                    'inline-block size-2 rounded-full',
                                    tierColor
                                )}
                            />
                            <span>{tierLabel}</span>
                        </p>
                    </div>
                    <div role="none" className="mt-1">
                        <Link
                            href="/account"
                            role="menuitem"
                            onClick={close}
                            className="text-secondary-200 hover:bg-secondary-800 focus-visible:ring-primary-500 flex w-full items-center rounded px-3 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                        >
                            계정 설정
                        </Link>
                        <LogoutButton />
                    </div>
                </div>
            ) : null}
        </div>
    );
}
