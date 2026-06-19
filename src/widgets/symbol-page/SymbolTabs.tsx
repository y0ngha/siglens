'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/shared/lib/cn';
import { TABS } from './utils/symbolTabsConfig';

interface SymbolTabsProps {
    /** Ticker symbol. Will be uppercased internally. */
    symbol: string;
}

/** Header nav strip for the 4 analysis pages of a symbol. Uses nav + aria-current (URL-based, not tablist). */
export function SymbolTabs({ symbol }: SymbolTabsProps) {
    const pathname = usePathname();
    const upper = symbol.toUpperCase();

    return (
        <nav
            aria-label="분석 종류"
            className="border-secondary-700 flex overflow-x-auto border-b"
        >
            {TABS.map(t => {
                const href = t.hrefBuilder(upper);
                const active = pathname === href;
                return (
                    <Link
                        key={t.key}
                        href={href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                            'focus-visible:ring-primary-500 -mb-px flex min-h-11 touch-manipulation items-center border-b-2 border-transparent px-4 py-2 text-sm whitespace-nowrap focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                            active
                                ? 'border-primary-500 text-secondary-100 font-medium'
                                : 'text-secondary-400 hover:text-secondary-100'
                        )}
                    >
                        {t.label}
                    </Link>
                );
            })}
        </nav>
    );
}
