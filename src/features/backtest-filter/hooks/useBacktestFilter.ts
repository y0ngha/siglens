'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import type { TabItem } from '@/shared/ui/tabs/utils/tabIds';
import {
    usePickUntilPopstate,
    useUrlSearchParam,
} from '@/shared/hooks/useUrlSearchParam';
import {
    BACKTEST_ALL_TAB,
    TICKER_QUERY_PARAM,
    buildTickerHref,
    resolveTickerTab,
} from '../lib/tickerQuery';

/** `useBacktestFilter`의 반환값. */
interface UseBacktestFilterReturn {
    /** "전체" 탭 + 종목별 탭. 값은 로케일과 무관하고 "전체"의 라벨만 번역된다. */
    tabItems: readonly TabItem<string>[];
    /** 지금 보이는 탭의 값(`BACKTEST_ALL_TAB` 또는 종목 심볼). */
    activeTab: string;
    /** 탭을 고르고 `?ticker=`에 반영한다. 목록에 없는 값은 "전체"로 떨어진다. */
    setActiveTab: (tab: string) => void;
    /** 특정 종목이 골라진 상태인가("전체"가 아님). */
    isFiltered: boolean;
}

/**
 * 백테스트 케이스 목록의 종목 탭 상태 — `?ticker=`와 동기화한다.
 *
 * `useSearchParams` 대신 `useUrlSearchParam`으로 읽는다. 전자는 정적 렌더에서 가장
 * 가까운 Suspense 경계까지 CSR bailout시켜 목록이 정적 HTML에서 빠진다. 서버 스냅샷이
 * `null`이므로 서버·하이드레이션 렌더는 항상 "전체"(정적 HTML과 일치)이고, 실제 URL 값은
 * 하이드레이션 직후에 반영된다.
 *
 * 사용자가 고른 탭은 로컬 상태(`usePickUntilPopstate`)가 URL보다 앞선다 —
 * `history.replaceState`는 구독자에게 알려지지 않기 때문이다. 뒤로/앞으로 가기
 * (`popstate`)가 오면 그 선택은 무효가 되고 화면이 다시 URL을 따른다(REACT.md
 * "URL State Rules").
 *
 * 케이스 목록 자체는 다루지 않는다 — 목록은 서버 컴포넌트로 렌더되고, 이 훅이 정한 탭에 맞춰
 * 보이는 범위를 고르는 일은 `BacktestTabs`가 한다(그쪽 JSDoc).
 */
export function useBacktestFilter(
    tickers: readonly string[]
): UseBacktestFilterReturn {
    const tickerParam = useUrlSearchParam(TICKER_QUERY_PARAM);
    const [pickedTab, pickTab] = usePickUntilPopstate<string>();

    const tMisc = useTranslations('shared.ui.misc');
    const allLabel = tMisc('filterAll');
    const tabItems = useMemo<readonly TabItem<string>[]>(
        () => [
            { value: BACKTEST_ALL_TAB, label: allLabel },
            ...tickers.map(ticker => ({ value: ticker, label: ticker })),
        ],
        [tickers, allLabel]
    );

    // ?ticker=는 목록에 없는 값(오래된 링크·오타)일 수 있으니 검증한다.
    const activeTab = pickedTab ?? resolveTickerTab(tickers, tickerParam);

    const setActiveTab = (next: string): void => {
        const resolved = resolveTickerTab(tickers, next);
        pickTab(resolved);
        // router.replace가 아니라 history.replaceState — 서버는 `?ticker=`를 읽지 않으므로
        // (목록 전체가 정적 HTML에 있다) 탭 클릭마다 RSC 왕복을 태울 이유가 없다.
        // `useTimeframeChange`와 같은 패턴이다.
        window.history.replaceState(
            null,
            '',
            buildTickerHref(window.location, resolved)
        );
    };

    return {
        tabItems,
        activeTab,
        setActiveTab,
        isFiltered: activeTab !== BACKTEST_ALL_TAB,
    };
}
