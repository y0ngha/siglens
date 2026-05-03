'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef } from 'react';
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

/**
 * Header segment tabs for the 4 analysis pages of a single symbol.
 *
 * Renders a WCAG-compliant `tablist` with keyboard navigation:
 * `←` / `→` move focus between tabs; `Home` / `End` jump to first/last.
 * Each tab is a Next.js `<Link>` so navigation is prefetched.
 */
export function SymbolTabs({ symbol }: SymbolTabsProps) {
    const pathname = usePathname();
    const tabsRef = useRef<HTMLDivElement>(null);
    const upper = symbol.toUpperCase();

    function handleKey(e: React.KeyboardEvent<HTMLDivElement>): void {
        const tabs = Array.from(
            tabsRef.current?.querySelectorAll<HTMLAnchorElement>(
                '[role="tab"]'
            ) ?? []
        );
        if (tabs.length === 0) return;
        const current = tabs.findIndex(t => t === document.activeElement);
        let next = current;
        if (e.key === 'ArrowRight') next = (current + 1) % tabs.length;
        else if (e.key === 'ArrowLeft')
            next = (current - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = tabs.length - 1;
        else return;
        e.preventDefault();
        tabs[next].focus();
    }

    return (
        <div
            ref={tabsRef}
            role="tablist"
            aria-label="분석 종류"
            onKeyDown={handleKey}
            className="border-border flex overflow-x-auto border-b"
        >
            {TABS.map(t => {
                const href = t.hrefBuilder(upper);
                const active = pathname === href;
                return (
                    <Link
                        key={t.key}
                        href={href}
                        role="tab"
                        aria-selected={active}
                        tabIndex={active ? 0 : -1}
                        className={cn(
                            'focus-visible:ring-primary px-4 py-2 text-sm whitespace-nowrap focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                            active
                                ? 'border-primary text-foreground border-b-2 font-medium'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        {t.label}
                    </Link>
                );
            })}
        </div>
    );
}
