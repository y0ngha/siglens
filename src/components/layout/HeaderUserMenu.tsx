'use client';

import Link from 'next/link';
import { useRef } from 'react';
import type { Tier } from '@y0ngha/siglens-core';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { useCurrentUser } from '@/components/hooks/useCurrentUser';
import { useEscapeKey } from '@/components/hooks/useEscapeKey';
import { usePopoverToggle } from '@/components/hooks/usePopoverToggle';
import { cn } from '@/lib/cn';

const TIER_DOT_COLOR: Record<Tier, string> = {
    free: 'bg-secondary-500',
    member: 'bg-primary-500',
    pro: 'bg-ui-warning',
};

const TIER_LABEL: Record<Tier, string> = {
    free: 'Free',
    member: 'Member',
    pro: 'Pro',
};

interface UserSummary {
    email: string;
    name: string | null;
}

function getInitial(user: UserSummary): string {
    const source = user.name && user.name.length > 0 ? user.name : user.email;
    return source.charAt(0).toUpperCase();
}

export function HeaderUserMenu() {
    const containerRef = useRef<HTMLDivElement>(null);
    const { data: user, isPending } = useCurrentUser();
    const { isOpen, close, toggle } = usePopoverToggle(containerRef);
    useEscapeKey(close, isOpen);

    if (isPending) {
        return <div aria-hidden className="size-10" />;
    }

    if (!user) {
        return (
            <nav aria-label="인증" className="flex items-center gap-2">
                <Link
                    href="/login"
                    className="text-secondary-200 hover:text-secondary-50 hidden min-h-11 items-center rounded px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none sm:inline-flex"
                >
                    로그인
                </Link>
                <Link
                    href="/signup"
                    className="inline-flex min-h-11 items-center rounded bg-blue-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                >
                    회원가입
                </Link>
            </nav>
        );
    }

    const initial = getInitial(user);
    const tierColor = TIER_DOT_COLOR[user.tier];
    const tierLabel = TIER_LABEL[user.tier];
    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={toggle}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                aria-label={`사용자 메뉴 (${tierLabel})`}
                className="bg-secondary-800 text-secondary-100 hover:bg-secondary-700 relative flex size-10 items-center justify-center rounded-full text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
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
                            {user.name ?? user.email}
                        </p>
                        {user.name ? (
                            <p className="text-secondary-400 text-xs">
                                {user.email}
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
                        <LogoutButton />
                    </div>
                </div>
            ) : null}
        </div>
    );
}
