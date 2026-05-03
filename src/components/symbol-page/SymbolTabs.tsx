'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

/** All segment tab definitions for the 4 symbol analysis pages. */
const TABS = [
    { key: 'chart', label: '차트', hrefBuilder: (s: string) => `/${s}` },
    {
        key: 'news',
        label: '뉴스',
        hrefBuilder: (s: string) => `/${s}/news`,
    },
    {
        key: 'fundamental',
        label: '펀더',
        hrefBuilder: (s: string) => `/${s}/fundamental`,
    },
    {
        key: 'overall',
        label: '종합',
        hrefBuilder: (s: string) => `/${s}/overall`,
    },
] as const;

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
                            'focus-visible:ring-primary-500 px-4 py-2 text-sm whitespace-nowrap focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                            active
                                ? 'border-primary-500 text-secondary-100 border-b-2 font-medium'
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
