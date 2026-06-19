'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/shared/lib/cn';

interface NavItem {
    readonly href: string;
    readonly label: string;
}

interface HeaderNavProps {
    readonly items: ReadonlyArray<NavItem>;
}

/** Client island for the primary nav; isolated so the surrounding Header can stay an RSC while `usePathname()` runs client-side. */
export function HeaderNav({ items }: HeaderNavProps) {
    const pathname = usePathname();
    return (
        <nav aria-label="주요 네비게이션" className="flex gap-1 sm:gap-4">
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
                        className={cn(
                            'focus-visible:ring-primary-500 -mb-px flex min-h-11 touch-manipulation items-center border-b-2 px-2 text-xs font-semibold tracking-[0.12em] uppercase transition-colors focus-visible:rounded focus-visible:ring-2 focus-visible:outline-none',
                            isActive
                                ? 'text-secondary-100 border-primary-500'
                                : 'text-secondary-400 hover:text-secondary-100 border-transparent'
                        )}
                    >
                        {item.label}
                    </Link>
                );
            })}
        </nav>
    );
}
