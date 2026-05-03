import Image from 'next/image';
import Link from 'next/link';
import { HeaderNav } from '@/components/layout/HeaderNav';
import {
    HeaderUserMenu,
    type HeaderUserMenuUser,
} from '@/components/layout/HeaderUserMenu';
import { TickerAutocomplete } from '@/components/search/TickerAutocomplete';
import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';
import { SITE_NAME } from '@/lib/seo';

const NAV_ITEMS = [{ href: '/market', label: '시장 분석' }] as const;

/**
 * Server Component shell.
 *
 * Fetches the current user once per request via `getCurrentUser()` and
 * passes a serializable subset down to the {@link HeaderUserMenu}
 * client island. This avoids the prior pattern where every render of
 * Header (or any client tree above it) re-ran the `useCurrentUser`
 * React Query check from scratch.
 */
export async function Header() {
    const authUser = await getCurrentUser();
    const currentUser: HeaderUserMenuUser | null = authUser
        ? {
              email: authUser.email,
              name: authUser.name,
              tier: authUser.tier,
          }
        : null;

    return (
        <header
            className="bg-secondary-900/90 supports-backdrop-filter:bg-secondary-900/75 border-secondary-800 sticky top-0 z-50 border-b backdrop-blur-md"
            role="banner"
        >
            <div className="flex h-14 items-center gap-2 px-3 sm:gap-4 sm:px-6">
                <Link
                    href="/"
                    title="홈으로"
                    aria-label={`${SITE_NAME} 홈`}
                    className="focus-visible:ring-primary-500 -mx-1 flex min-h-11 shrink-0 touch-manipulation items-center gap-2 rounded px-1 focus-visible:ring-2 focus-visible:outline-none"
                >
                    <Image
                        src="/icon96.png"
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
                <HeaderNav items={NAV_ITEMS} />
                <div className="ml-auto flex w-full max-w-40 min-w-0 justify-end sm:max-w-xs">
                    <TickerAutocomplete size="sm" />
                </div>
                <div className="flex shrink-0 items-center">
                    <HeaderUserMenu currentUser={currentUser} />
                </div>
            </div>
        </header>
    );
}
