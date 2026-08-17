'use client';

import Link from 'next/link';

import { useRecentSearches } from '../hooks/useRecentSearches';
import { TickerAutocomplete } from './TickerAutocomplete';
import { cn } from '@/shared/lib/cn';

interface SymbolSearchPanelProps {
    className?: string;
}

export function SymbolSearchPanel({ className }: SymbolSearchPanelProps) {
    const { recentSearches, addSearch, removeSearch, clearAll } =
        useRecentSearches();

    return (
        <div className={cn('flex w-full flex-col', className)}>
            <TickerAutocomplete size="lg" onSelect={addSearch} />

            {recentSearches.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                    <span className="text-xs text-secondary-500">
                        최근 검색
                    </span>
                    {recentSearches.map(ticker => (
                        <span
                            key={ticker}
                            className="inline-flex touch-manipulation items-center gap-1 rounded-full border border-primary-600/30 bg-primary-600/5 pr-1 pl-3 text-xs text-secondary-200 transition-colors hover:border-primary-500/60 hover:text-primary-300"
                        >
                            {/*
                                a11y target-size: WCAG 2.5.8 requires interactive
                                targets ≥ 24×24 CSS px. The ✕ button's visible
                                glyph stays small because it inherits text-xs
                                sizing inside the 24×24 flex box.
                            */}
                            <Link
                                href={`/${ticker}`}
                                onClick={() => addSearch(ticker)}
                                // 최근 검색 목록으로 다수 렌더 —
                                // docs/architecture/CDN_CACHING.md §1
                                prefetch={false}
                                className="inline-flex min-h-6 items-center rounded py-1.5 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                            >
                                {ticker}
                            </Link>
                            <button
                                type="button"
                                aria-label={`${ticker} 최근 검색에서 제거`}
                                onClick={() => removeSearch(ticker)}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-full leading-none text-secondary-500 hover:text-secondary-100 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                            >
                                ✕
                            </button>
                        </span>
                    ))}
                    <button
                        type="button"
                        onClick={clearAll}
                        className="ml-1 text-xs text-secondary-500 underline-offset-2 hover:text-secondary-300 hover:underline"
                    >
                        모두 지우기
                    </button>
                </div>
            )}
        </div>
    );
}
