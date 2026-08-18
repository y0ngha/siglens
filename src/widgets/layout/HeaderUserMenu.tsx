'use client';

import { LogoutButton } from '@/features/auth-logout';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { usePopoverToggle } from '@/shared/hooks/usePopoverToggle';
import { TIER_LABEL } from '@/shared/lib/auth/tierLabel';
import { cn } from '@/shared/lib/cn';
import type { Tier } from '@y0ngha/siglens-core';
import Image from 'next/image';
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
    readonly avatarUrl: string | null;
}

interface HeaderUserMenuProps {
    /** Current user; null when guest. Fetched server-side in Header. */
    readonly currentUser: HeaderUserMenuUser | null;
    /**
     * When true, renders a skeleton placeholder instead of login/signup buttons.
     * Used as the inner Suspense fallback when the hint cookie signals the user
     * is likely logged in while the DB lookup is still in flight.
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
                role="status"
                aria-label="로딩 중"
                className="size-10 animate-pulse rounded-full bg-secondary-800 motion-reduce:animate-none"
            />
        );
    }

    if (!currentUser) {
        return (
            <nav aria-label="인증" className="flex items-center gap-2">
                {/*
                    전역 헤더의 인증 CTA — 비로그인 방문자의 **모든** 페이지뷰에 렌더되므로
                    NAV_VERTICALS·로고와 같은 범주다. 전환 행동이라 prefetch를 남길지 검토했으나
                    실측이 반대였다(2026-08-13, 12h): `/login` 히트율 22.2%(miss 54),
                    `/signup` 44.0%(miss 38) — 진입 페이지별 `_rsc` 해시 파편화로 캐시가
                    재사용되지 않고 미스만 쌓이고 있었다. 두 페이지 HTML은 엣지에 캐시돼
                    있어 클릭 시점 fetch로도 충분히 빠르다.
                    (docs/architecture/CDN_CACHING.md §1)
                */}
                <Link
                    href="/login"
                    prefetch={false}
                    className="hidden min-h-11 items-center rounded px-3 text-sm font-medium text-secondary-200 transition-colors hover:text-secondary-50 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none sm:inline-flex"
                >
                    로그인
                </Link>
                <Link
                    href="/signup"
                    prefetch={false}
                    className="inline-flex min-h-11 items-center rounded bg-primary-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
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
                className="relative flex size-10 items-center justify-center rounded-full bg-secondary-800 text-sm font-semibold text-secondary-100 transition-colors hover:bg-secondary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
                {currentUser.avatarUrl ? (
                    <Image
                        src={currentUser.avatarUrl}
                        alt="아바타 이미지"
                        width={40}
                        height={40}
                        className="size-full rounded-full object-cover"
                    />
                ) : (
                    <span aria-hidden>{initial}</span>
                )}
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
                    className="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-secondary-800 bg-secondary-900 p-2 shadow-2xl"
                >
                    <div className="border-b border-secondary-800 px-3 py-2 text-sm">
                        <p className="font-semibold text-secondary-50">
                            {currentUser.name ?? currentUser.email}
                        </p>
                        {currentUser.name ? (
                            <p className="text-xs text-secondary-400">
                                {currentUser.email}
                            </p>
                        ) : null}
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-secondary-400">
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
                            className="flex w-full items-center rounded px-3 py-2 text-left text-sm text-secondary-200 transition-colors hover:bg-secondary-800 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
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
