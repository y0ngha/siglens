'use client';

import Link from 'next/link';

import { useRecentSearches } from '@/components/search/hooks/useRecentSearches';
import { TickerAutocomplete } from '@/components/search/TickerAutocomplete';
import { cn } from '@/lib/cn';

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
                    <span className="text-secondary-500 text-xs">
                        최근 검색
                    </span>
                    {recentSearches.map(ticker => (
                        <span
                            key={ticker}
                            className="border-primary-600/30 bg-primary-600/5 text-secondary-200 hover:border-primary-500/60 hover:text-primary-300 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors"
                        >
                            <Link
                                href={`/${ticker}`}
                                onClick={() => addSearch(ticker)}
                                className="outline-none"
                            >
                                {ticker}
                            </Link>
                            <button
                                type="button"
                                aria-label={`${ticker} 최근 검색에서 제거`}
                                onClick={() => removeSearch(ticker)}
                                className="text-secondary-500 hover:text-secondary-100 leading-none"
                            >
                                ×
                            </button>
                        </span>
                    ))}
                    <button
                        type="button"
                        onClick={clearAll}
                        className="text-secondary-500 hover:text-secondary-300 ml-1 text-xs underline-offset-2 hover:underline"
                    >
                        모두 지우기
                    </button>
                </div>
            )}
        </div>
    );
}
