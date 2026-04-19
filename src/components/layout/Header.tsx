'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { TickerAutocomplete } from '@/components/search/TickerAutocomplete';
import { SITE_NAME } from '@/lib/seo';

const NAV_ITEMS = [{ href: '/market', label: '시장' }] as const;

export function Header() {
    const pathname = usePathname();
    return (
        <header
            className="bg-secondary-900/90 supports-[backdrop-filter]:bg-secondary-900/75 border-secondary-800 sticky top-0 z-40 border-b backdrop-blur-md"
            role="banner"
        >
            <div className="mx-auto flex h-14 items-center gap-3 px-4 sm:gap-6 sm:px-6 lg:px-[15vw]">
                <Link
                    href="/"
                    title="홈으로"
                    className="focus-visible:ring-primary-500 -mx-1 flex min-h-11 shrink-0 touch-manipulation items-center gap-2 rounded px-1 focus-visible:ring-2 focus-visible:outline-none"
                >
                    <Image
                        src="/icon24.png"
                        alt=""
                        width={24}
                        height={24}
                        className="h-6 w-6"
                        priority
                    />
                    <span
                        translate="no"
                        className="text-secondary-100 font-mono text-sm font-semibold tracking-[0.15em] uppercase"
                    >
                        {SITE_NAME}
                    </span>
                </Link>
                <nav aria-label="주요 네비게이션" className="flex gap-1 sm:gap-4">
                    {NAV_ITEMS.map(item => {
                        const isActive =
                            pathname === item.href ||
                            pathname.startsWith(`${item.href}/`);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={isActive ? 'page' : undefined}
                                className={cn(
                                    'focus-visible:ring-primary-500 -mb-px flex min-h-11 touch-manipulation items-center border-b-2 px-2 text-xs font-semibold tracking-[0.12em] uppercase transition-colors focus-visible:rounded focus-visible:ring-2 focus-visible:outline-none',
                                    isActive
                                        ? 'text-secondary-100 border-primary-500'
                                        : 'text-secondary-400 border-transparent hover:text-secondary-100'
                                )}
                            >
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
                <div className="ml-auto w-full max-w-[10rem] sm:max-w-xs">
                    <TickerAutocomplete size="sm" />
                </div>
            </div>
        </header>
    );
}
