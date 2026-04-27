'use client';

import { useMemo } from 'react';
import type { BacktestCase } from '@y0ngha/siglens-core';
import type { TabItem } from '@/components/ui/tabs';
import { useQueryParamState } from '@/components/hooks/useQueryParamState';

const ALL_TAB = '전체';

interface UseBacktestFilterReturn {
    tabItems: readonly TabItem<string>[];
    activeTab: string;
    setActiveTab: (tab: string) => void;
    filtered: BacktestCase[];
}

export function useBacktestFilter(
    cases: BacktestCase[],
    tickers: string[]
): UseBacktestFilterReturn {
    const [rawTicker, setTicker] = useQueryParamState('ticker', ALL_TAB);

    const tabItems = useMemo<readonly TabItem<string>[]>(
        () => [ALL_TAB, ...tickers].map(t => ({ value: t, label: t })),
        [tickers]
    );

    const activeTab = useMemo(
        () => tabItems.find(t => t.value === rawTicker)?.value ?? ALL_TAB,
        [tabItems, rawTicker]
    );

    const filtered = useMemo(
        () =>
            activeTab === ALL_TAB
                ? cases
                : cases.filter(c => c.ticker === activeTab),
        [cases, activeTab]
    );

    return { tabItems, activeTab, setActiveTab: setTicker, filtered };
}
