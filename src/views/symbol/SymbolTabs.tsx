'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/shared/lib/cn';
import { useAssetInfo } from '@/entities/ticker/hooks/useAssetInfo';
import {
    DEFAULT_MARKET_PROFILE,
    marketProfileOf,
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

    const upper = symbol.toUpperCase();

    // Loading state: assetInfo === undefined means the RQ query is still in-flight.
    // Render a placeholder that matches the tab bar height/border so there is no
    // layout shift when the real tabs appear.
    if (assetInfo === undefined) {
        return <div className="border-secondary-700 h-11 border-b" />;
    }

    /**
     * Null = unknown symbol (the query resolved but found no matching asset).
     * Default to the us-equity profile so we show the full tab set rather than
     * a blank nav — the tab bar is still functional for any valid equity route.
     */
    const profile =
        assetInfo !== null
            ? marketProfileOf(assetInfo)
            : DEFAULT_MARKET_PROFILE;
    const tabs = tabsFor(profile);

    return (
        <nav
            aria-label="분석 종류"
            // overflow-x-auto만 두면 CSS 명세상 overflow-y가 visible→auto로 승격되고,
            // 각 탭 링크의 -mb-px가 1px 세로 오버플로를 만들어 모바일에서 원치 않는
            // 세로 스크롤(바)이 생긴다. overflow-y-hidden으로 세로 스크롤을 차단하고
            // 가로 스크롤만 유지한다.
            className="border-secondary-700 flex overflow-x-auto overflow-y-hidden border-b"
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
