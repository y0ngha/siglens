'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
    addRecentSearch,
    clearRecentSearches,
    removeRecentSearch,
    type RecentSearchEntry,
} from '@/entities/ticker/lib/recentSearches';
import { trackAdsConversion } from '@/shared/lib/googleAds';
import {
    getRecentSearchesSnapshot,
    getServerRecentSearchesSnapshot,
    notifyRecentSearchesChange,
    subscribeRecentSearches,
} from '../lib/recentSearchesStore';
import { useCompanyNameBackfill } from './useCompanyNameBackfill';

/** `useRecentSearches`의 반환값. */
export interface UseRecentSearchesResult {
    /** 최근 검색(최신이 앞). 서버·하이드레이션 렌더에서는 빈 배열이다. */
    recentSearches: RecentSearchEntry[];
    /** 표시용 회사명을 아는 호출부는 `{ symbol, label }`을 넘긴다. */
    addSearch: (entry: string | RecentSearchEntry) => void;
    removeSearch: (symbol: string) => void;
    clearAll: () => void;
}

/**
 * 최근 검색 목록과 그 조작. 히어로 칩(`SymbolSearchPanel`)과 모바일 오버레이가 같은
 * 저장소를 구독하므로 한쪽의 변경이 다른 쪽에 바로 반영된다. 반환 함수는 참조가 안정적이다.
 */
export function useRecentSearches(): UseRecentSearchesResult {
    const recentSearches = useSyncExternalStore(
        subscribeRecentSearches,
        getRecentSearchesSnapshot,
        getServerRecentSearchesSnapshot
    );

    const addSearch = useCallback((entry: string | RecentSearchEntry) => {
        addRecentSearch(entry);
        notifyRecentSearchesChange();
        // 검색에서 종목을 고르는 모든 경로(오버레이·패널 자동완성·최근 검색 클릭)가
        // 여기를 지난다 — 호출부마다 넣는 대신 한 곳에서 센다.
        trackAdsConversion('tickerSelect');
    }, []);

    const removeSearch = useCallback((symbol: string) => {
        removeRecentSearch(symbol);
        notifyRecentSearchesChange();
    }, []);

    const clearAll = useCallback(() => {
        clearRecentSearches();
        notifyRecentSearchesChange();
    }, []);

    // 이펙트를 품은 훅이라 핸들러 뒤, `return` 직전에 둔다(REACT.md#HK-1).
    useCompanyNameBackfill(recentSearches);

    return { recentSearches, addSearch, removeSearch, clearAll };
}
