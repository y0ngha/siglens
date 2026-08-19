'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { BacktestCase } from '@y0ngha/siglens-core';
import type { TabItem } from '@/shared/ui/tabs';

const ALL_TAB = '전체';
const TICKER_QUERY_PARAM = 'ticker';

interface UseBacktestFilterReturn {
    tabItems: readonly TabItem<string>[];
    activeTab: string;
    setActiveTab: (tab: string) => void;
    filtered: BacktestCase[];
}

// activeTab의 초기값은 useSearchParams()가 아니라 고정된 ALL_TAB이다.
// Next.js는 정적 렌더링 중 useSearchParams()를 호출하는 컴포넌트를 감싼
// Suspense 경계의 실제 자식 전체를 정적 HTML에서 제외하고 fallback만 굽는다
// (docs/conventions/CONVENTIONS.md "URL State Rules" 참고). 이 훅은 그 대신
// window.location을 마운트 이후 useEffect에서만 읽어 ?ticker= 딥링크를
// 동기화하므로, 초기 렌더(=SSR 정적 셸)는 항상 전체 케이스 목록과 일치한다.
export function useBacktestFilter(
    cases: BacktestCase[],
    tickers: string[]
): UseBacktestFilterReturn {
    const [activeTab, setActiveTabState] = useState(ALL_TAB);

    const router = useRouter();
    const pathname = usePathname();

    const tabItems = useMemo<readonly TabItem<string>[]>(
        () => [ALL_TAB, ...tickers].map(t => ({ value: t, label: t })),
        [tickers]
    );

    const filtered = useMemo(
        () =>
            activeTab === ALL_TAB
                ? cases
                : cases.filter(c => c.ticker === activeTab),
        [cases, activeTab]
    );

    const setActiveTab = useCallback(
        (next: string) => {
            const resolved =
                tabItems.find(t => t.value === next)?.value ?? ALL_TAB;
            setActiveTabState(resolved);

            const params = new URLSearchParams(window.location.search);
            if (resolved === ALL_TAB) params.delete(TICKER_QUERY_PARAM);
            else params.set(TICKER_QUERY_PARAM, resolved);
            const qs = params.toString();
            router.replace(qs === '' ? pathname : `${pathname}?${qs}`, {
                scroll: false,
            });
        },
        [pathname, router, tabItems]
    );

    useEffect(() => {
        const ticker = new URLSearchParams(window.location.search).get(
            TICKER_QUERY_PARAM
        );
        const resolved = tabItems.find(t => t.value === ticker)?.value;
        if (resolved) setActiveTabState(resolved);
    }, [tabItems]);

    return { tabItems, activeTab, setActiveTab, filtered };
}
