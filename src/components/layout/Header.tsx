import { HeaderNav } from '@/components/layout/HeaderNav';
import { HeaderNavStatic } from '@/components/layout/HeaderNavStatic';
import {
    HeaderUserMenu,
    type HeaderUserMenuUser,
} from '@/components/layout/HeaderUserMenu';
import { TickerAutocomplete } from '@/components/search/TickerAutocomplete';
import { SITE_NAME } from '@/lib/seo';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';

const NAV_ITEMS = [{ href: '/market', label: '시장 분석' }] as const;

interface HeaderProps {
    /** Resolved current user (server-fetched in `app/layout.tsx`); null for guests. */
    readonly currentUser: HeaderUserMenuUser | null;
    /**
     * When true, renders a skeleton for the user menu instead of its real content.
     * Used as the Suspense fallback:
     *   - outer fallback: always true (hint cookie not yet read)
     *   - inner fallback: true only when the hint cookie signals an active session
     */
    readonly loadingUserMenu?: boolean;
}

/** Presentational shell; receives resolved current user as a prop so layer rules forbid direct infrastructure access here. */
export function Header({ currentUser, loadingUserMenu }: HeaderProps) {
    return (
        <header
            className="bg-secondary-900/90 supports-backdrop-filter:bg-secondary-900/75 border-secondary-800 sticky top-0 z-50 border-b backdrop-blur-md"
            role="banner"
        >
            <div className="flex h-14 items-center gap-2 px-3 sm:gap-4 sm:px-6">
                <Link
                    href="/"
                    title="홈으로"
                    // Visible brand text is `text-...uppercase` (renders "SIGLENS"),
                    // so the accessible name must match what users see (WCAG 2.5.3).
                    aria-label={`${SITE_NAME.toUpperCase()} 홈`}
                    className="focus-visible:ring-primary-500 -mx-1 flex min-h-11 shrink-0 touch-manipulation items-center gap-2 rounded px-1 focus-visible:ring-2 focus-visible:outline-none"
                >
                    {/*
                        Display size is 24×24. Serving the 96×96 PNG wasted
                        ~7 KB; icon24.png is ~1.3 KB and the LCP/SEO audits
                        flag the upscaled asset as `uses-responsive-images`.
                    */}
                    <Image
                        src="/icon24.png"
                        alt="Siglens 로고"
                        width={24}
                        height={24}
                        className="h-6 w-6"
                        priority
                        unoptimized
                    />
                    <span
                        translate="no"
                        className="text-secondary-100 hidden font-mono text-sm font-semibold tracking-[0.15em] uppercase sm:inline"
                    >
                        {SITE_NAME}
                    </span>
                </Link>
                {/* HeaderNav는 usePathname() 사용 — Suspense로 감싸 PPR prerender shell이 정적 fallback으로 완료되도록 함 */}
                <Suspense fallback={<HeaderNavStatic items={NAV_ITEMS} />}>
                    <HeaderNav items={NAV_ITEMS} />
                </Suspense>
                <div className="ml-auto flex w-full max-w-40 min-w-0 justify-end sm:max-w-xs">
                    <TickerAutocomplete size="sm" />
                </div>
                <div className="flex shrink-0 items-center">
                    <HeaderUserMenu
                        currentUser={currentUser}
                        loading={loadingUserMenu}
                    />
                </div>
            </div>
        </header>
    );
}
