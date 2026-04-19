'use client';

import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { BacktestCase } from '@/domain/types';
import { BacktestCaseList } from './BacktestCaseList';

interface BacktestTabsProps {
    cases: BacktestCase[];
    tickers: string[];
}

const ALL_TAB = '전체';

export function BacktestTabs({ cases, tickers }: BacktestTabsProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const tabs = useMemo(() => [ALL_TAB, ...tickers], [tickers]);

    const active = searchParams.get('ticker') ?? ALL_TAB;
    const safeActive = tabs.includes(active) ? active : ALL_TAB;

    const filtered =
        safeActive === ALL_TAB ? cases : cases.filter(c => c.ticker === safeActive);

    const setActive = useCallback(
        (tab: string) => {
            const params = new URLSearchParams(searchParams.toString());
            if (tab === ALL_TAB) {
                params.delete('ticker');
            } else {
                params.set('ticker', tab);
            }
            router.push(`?${params.toString()}`, { scroll: false });
        },
        [router, searchParams]
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLDivElement>) => {
            const currentIdx = tabs.indexOf(safeActive);
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                setActive(tabs[(currentIdx + 1) % tabs.length]);
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                setActive(tabs[(currentIdx - 1 + tabs.length) % tabs.length]);
            } else if (e.key === 'Home') {
                e.preventDefault();
                setActive(tabs[0]);
            } else if (e.key === 'End') {
                e.preventDefault();
                setActive(tabs[tabs.length - 1]);
            }
        },
        [safeActive, tabs, setActive]
    );

    return (
        <div>
            <div
                role="tablist"
                aria-label="티커 필터"
                onKeyDown={handleKeyDown}
                className="overflow-x-auto border-b border-secondary-800"
            >
                <div className="flex min-w-max px-4">
                    {tabs.map(tab => {
                        const isSelected = tab === safeActive;
                        return (
                            <button
                                key={tab}
                                role="tab"
                                aria-selected={isSelected}
                                aria-controls="backtest-case-list"
                                tabIndex={isSelected ? 0 : -1}
                                onClick={() => setActive(tab)}
                                className={`[touch-action:manipulation] cursor-pointer border-b-2 px-3.5 py-2.5 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1 focus-visible:ring-offset-secondary-900 ${
                                    isSelected
                                        ? 'border-primary-400 text-primary-400'
                                        : 'border-transparent text-secondary-500 hover:text-secondary-300'
                                }`}
                            >
                                {tab}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div
                id="backtest-case-list"
                role="tabpanel"
                aria-label={`${safeActive} 케이스 목록`}
            >
                <BacktestCaseList cases={filtered} />
            </div>
        </div>
    );
}
