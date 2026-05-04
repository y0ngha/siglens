'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AUTH_HINT_COOKIE_NAME } from '@/lib/auth/cookieNames';

/**
 * Suspense fallback for the header user menu.
 *
 * On first server render: shows a skeleton circle (auth state unknown).
 * After hydration: reads the client-visible hint cookie and immediately
 * shows login/signup buttons if the user is not logged in, eliminating the
 * visible flash of wrong content for not-logged-in users.
 *
 * The hint cookie (siglens_auth=1) is set on login and cleared on logout
 * alongside the httpOnly session cookie.
 */
export function HeaderUserMenuFallback() {
    const [showLoginLinks, setShowLoginLinks] = useState(false);

    useEffect(() => {
        const hasHint = document.cookie
            .split(';')
            .some(c => c.trim().startsWith(`${AUTH_HINT_COOKIE_NAME}=`));
        if (!hasHint) {
            setShowLoginLinks(true);
        }
    }, []);

    if (showLoginLinks) {
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

    return (
        <div
            role="status"
            aria-label="로딩 중"
            className="bg-secondary-800 size-10 animate-pulse rounded-full"
        />
    );
}
