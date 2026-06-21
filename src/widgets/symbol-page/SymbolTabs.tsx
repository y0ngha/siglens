'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/shared/lib/cn';
import { useAssetInfo } from './hooks/useAssetInfo';
import {
    marketProfileOf,
    DEFAULT_MARKET_PROFILE,
} from '@/shared/config/marketProfile';
import { tabsFor } from './utils/symbolTabsConfig';

interface SymbolTabsProps {
    /** Ticker symbol. Will be uppercased internally. */
    symbol: string;
}

/** Header nav strip for the 4 analysis pages of a symbol. Uses nav + aria-current (URL-based, not tablist). */
export function SymbolTabs({ symbol }: SymbolTabsProps) {
    const pathname = usePathname();
    const assetInfo = useAssetInfo(symbol);

    // Derived variables come after all hook calls (MISTAKES §17).
    const upper = symbol.toUpperCase();
    const profile = assetInfo
        ? marketProfileOf(assetInfo)
        : DEFAULT_MARKET_PROFILE;
    const tabs = tabsFor(profile);

    // Loading state: assetInfo === undefined means the RQ query is still in-flight.
    // Render a placeholder that matches the tab bar height/border so there is no
    // layout shift when the real tabs appear.
    if (assetInfo === undefined) {
        return <div className="border-secondary-700 h-11 border-b" />;
    }

    return (
        <nav
            aria-label="분석 종류"
            className="border-secondary-700 flex overflow-x-auto border-b"
        >
            {tabs.map(t => {
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
