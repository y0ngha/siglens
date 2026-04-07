'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useRecentSearches } from '@/components/search/hooks/useRecentSearches';
import { cn } from '@/lib/cn';

interface SymbolSearchPanelProps {
    className?: string;
}

export function SymbolSearchPanel({ className }: SymbolSearchPanelProps) {
    const router = useRouter();
    const [value, setValue] = useState('');
    const { recentSearches, addSearch, removeSearch, clearAll } =
        useRecentSearches();

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const trimmed = value.trim().toUpperCase();
        if (!trimmed) return;
        addSearch(trimmed);
        router.push(`/${trimmed}`);
    };

    return (
        <div className={cn('flex w-full flex-col', className)}>
            <form
                onSubmit={handleSubmit}
                className="flex w-full max-w-md items-center gap-2"
            >
                <input
                    name="symbol"
                    autoComplete="off"
                    aria-label="종목 티커 검색"
                    type="text"
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    placeholder="티커 입력 (예: AAPL)"
                    className="bg-secondary-800 border-secondary-700 text-secondary-100 placeholder-secondary-500 focus:border-primary-600 focus:ring-primary-500 focus-glow w-full rounded-lg border px-4 py-3 text-base transition-colors outline-none focus:ring-1 sm:w-96"
                />
                <button
                    type="submit"
                    className="bg-primary-600 hover:bg-primary-700 shrink-0 rounded-lg px-6 py-3 text-base font-semibold whitespace-nowrap text-white transition-colors"
                >
                    검색
                </button>
            </form>

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
