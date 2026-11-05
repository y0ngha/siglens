'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useWatchlist, type UseWatchlistResult } from '../hooks/useWatchlist';

/** 알약 ★가 읽는 관심종목 상태. `useWatchlist` 중 알약이 쓰는 것만 담는다. */
type PillWatchlist = Pick<UseWatchlistResult, 'has' | 'toggle' | 'isHydrated'>;

const PillWatchlistContext = createContext<PillWatchlist | null>(null);

interface WatchlistPillScopeProps {
    children: ReactNode;
}

/**
 * 종목 알약 그리드(`CategoryCardGrid`) 하나에 두는 관심종목 구독. 알약 ★는 `useWatchlist`를
 * 직접 부르지 않고 여기서 받는다 — 알약마다 부르면 알약 수만큼 현재 사용자 쿼리·하이드레이션을
 * 따로 구독해, 쿼리 상태가 바뀔 때마다 모든 알약이 다시 그려진다. 내려주는 값은 `has`·`toggle`·
 * `isHydrated`가 바뀔 때만 바뀌므로 알약도 그때만 다시 그린다. 다시 재려면 react-data-xray 로
 * 비회원 홈 로드의 `WatchlistPillToggle` 렌더 수를 본다.
 *
 * 그리드는 링크를 서버에서 그리는 서버 컴포넌트라, 이 클라이언트 경계는 서버가 그린 자식을
 * 그대로 통과시킨다.
 */
export function WatchlistPillScope({ children }: WatchlistPillScopeProps) {
    const { has, toggle, isHydrated } = useWatchlist();
    const value = useMemo(
        () => ({ has, toggle, isHydrated }),
        [has, toggle, isHydrated]
    );
    return (
        <PillWatchlistContext.Provider value={value}>
            {children}
        </PillWatchlistContext.Provider>
    );
}

/**
 * 가장 가까운 `WatchlistPillScope`의 관심종목 상태. 알약 ★는 그리드 밖에서 쓰지 않으므로,
 * 스코프 없이 부르면 알약마다 구독하던 구조로 조용히 돌아가지 않게 바로 던진다.
 */
export function useWatchlistPill(): PillWatchlist {
    const value = useContext(PillWatchlistContext);
    if (value === null)
        throw new Error(
            'useWatchlistPill must be used inside WatchlistPillScope'
        );
    return value;
}
