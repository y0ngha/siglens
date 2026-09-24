'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { BacktestCase } from '@y0ngha/siglens-core';
import type { TabItem } from '@/shared/ui/tabs';

/**
 * "전체" 탭의 **값**. 표시 라벨과 분리한다 — 값은 쿼리 파라미터 비교와
 * 상태 식별에 쓰이므로 로케일에 따라 바뀌면 `/en/backtesting?ticker=…`의
 * 왕복이 깨진다. 라벨만 `shared.ui.misc.filterAll`로 번역한다.
 */
const ALL_TAB = 'all';
const TICKER_QUERY_PARAM = 'ticker';

interface UseBacktestFilterReturn {
    tabItems: readonly TabItem<string>[];
    activeTab: string;
    setActiveTab: (tab: string) => void;
    filtered: BacktestCase[];
}

/** 구독자를 등록만 하고 절대 알리지 않는다. 그 결과, 같은 pathname에서
 *  `?ticker=`만 바뀌는 히스토리 이동(뒤로/앞으로가기)은 이 스토어만으로는 이
 *  훅을 재렌더시키지 않는다 — popstate를 듣지 않던 예전 useEffect 버전도 같은
 *  한계였다(그때도 `[tabItems]` 의존 effect만 돌고 URL 변화 자체는 별도로
 *  감지하지 않았다). 이 페이지에서 `?ticker=`를 실제로 쓰는 쪽은 `setActiveTab`
 *  하나뿐이고, 그 경로는 `router.replace` 전에 `setExplicitTab`을 먼저 불러
 *  `explicitTab`으로 이미 반영된다(`activeTab = explicitTab ?? urlTab ?? ALL_TAB`).
 *  `getUrlTicker`(아래) 자체는 `useSyncExternalStore`의 `getSnapshot` 계약대로
 *  **매 렌더마다** 호출되므로, 다른 이유로 이 훅이 재렌더되면 그 렌더는 항상
 *  현재 URL을 읽는다 — "읽긴 매번 읽되, 이 스토어가 능동적으로 재렌더를 걸지는
 *  않는다"가 정확한 계약이다. */
function subscribeUrlTickerNever(): () => void {
    return () => {};
}

function getUrlTicker(): string | null {
    return new URLSearchParams(window.location.search).get(TICKER_QUERY_PARAM);
}

function getServerUrlTicker(): null {
    return null;
}

// activeTab의 초기값은 useSearchParams()가 아니라 고정된 ALL_TAB이다.
// Next.js는 정적 렌더링 중 useSearchParams()를 호출하는 컴포넌트를 감싼
// Suspense 경계의 실제 자식 전체를 정적 HTML에서 제외하고 fallback만 굽는다
// (docs/conventions/CONVENTIONS.md "URL State Rules" 참고). 이 훅은 그 대신
// `useSyncExternalStore`로 `?ticker=`를 읽어 ?ticker= 딥링크를 동기화하므로,
// 초기 렌더(=SSR 정적 셸/하이드레이션 렌더)는 항상 전체 케이스 목록과 일치하고
// (`getServerUrlTicker`가 `null`), 실제 값은 하이드레이션 이후에만 반영된다.
export function useBacktestFilter(
    cases: BacktestCase[],
    tickers: string[]
): UseBacktestFilterReturn {
    // 사용자가 명시적으로 고른 탭. `null`이면 아직 고르지 않은 것이고, 그때만
    // 아래 `urlTicker`가 초기 탭을 정한다 — 한 번 고르면 그 뒤로는 이 값이 이긴다
    // (예전 useEffect 버전도 같았다: `setActiveTab`이 URL을 함께 갱신해 `[tabItems]`
    // 재평가가 사실상 같은 값을 다시 쓸 뿐이었다).
    const [explicitTab, setExplicitTab] = useState<string | null>(null);
    const urlTicker = useSyncExternalStore(
        subscribeUrlTickerNever,
        getUrlTicker,
        getServerUrlTicker
    );

    const router = useRouter();
    const pathname = usePathname();

    const tMisc = useTranslations('shared.ui.misc');
    const allLabel = tMisc('filterAll');
    const tabItems = useMemo<readonly TabItem<string>[]>(
        () => [
            { value: ALL_TAB, label: allLabel },
            ...tickers.map(ticker => ({ value: ticker, label: ticker })),
        ],
        [tickers, allLabel]
    );

    // urlTicker는 tabItems에 없는 값(오래된 링크·오타)일 수 있으니 검증한다.
    // 이 memo가 바로 예전 `[tabItems]` 의존 effect가 재검증하던 그 조합이다.
    const urlTab = useMemo(
        () => tabItems.find(t => t.value === urlTicker)?.value ?? null,
        [tabItems, urlTicker]
    );
    const activeTab = explicitTab ?? urlTab ?? ALL_TAB;

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
            setExplicitTab(resolved);

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

    return { tabItems, activeTab, setActiveTab, filtered };
}
