'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { SymbolTabs } from '@/components/symbol-page/SymbolTabs';
import { SymbolTabsSkeleton } from '@/components/symbol-page/SymbolTabsSkeleton';
import { useAssetInfo } from '@/components/symbol-page/hooks/useAssetInfo';

interface SymbolLayoutHeaderProps {
    /** Ticker from the dynamic route param. Internally upper-cased for the breadcrumb. */
    symbol: string;
}

/**
 * Layout-level header rendered on every `/[symbol]/*` page.
 *
 * Contains the page-agnostic UI: SIGLENS logo, ticker breadcrumb, and SymbolTabs.
 * Chart-specific controls (TimeframeSelector) live inside the chart page's own
 * scroll-locked container so the layout stays free of `useSearchParams` (which
 * would force the whole route to be dynamic under Next.js Cache Components).
 */
export function SymbolLayoutHeader({ symbol }: SymbolLayoutHeaderProps) {
    const ticker = symbol.toUpperCase();
    const assetInfo = useAssetInfo(symbol);
    const hasCompanyName = !!assetInfo && assetInfo.name !== ticker;

    return (
        <header className="px-4 py-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Link
                        href="/"
                        className="text-secondary-500 hover:text-secondary-300 font-mono text-xs tracking-[0.2em] uppercase transition-colors"
                    >
                        SIGLENS
                    </Link>
                    <span className="text-secondary-700">/</span>
                    <h1 className="text-secondary-100 text-lg font-semibold tracking-wide">
                        {assetInfo?.koreanName && (
                            <span className="text-secondary-300">
                                {assetInfo.koreanName}
                                {hasCompanyName ? ', ' : ' '}
                            </span>
                        )}
                        {assetInfo && hasCompanyName && (
                            <span className="text-secondary-200">
                                {assetInfo.name}{' '}
                            </span>
                        )}
                        ({ticker})<span className="sr-only"> 기술적 분석</span>
                    </h1>
                </div>
            </div>
            <div className="-mx-4 mt-3">
                <Suspense fallback={<SymbolTabsSkeleton />}>
                    <SymbolTabs symbol={symbol} />
                </Suspense>
            </div>
        </header>
    );
}
