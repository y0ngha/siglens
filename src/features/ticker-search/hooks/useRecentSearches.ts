'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

import type { RecentSearchEntry } from '@/entities/ticker';
import {
    addRecentSearch,
    clearRecentSearches,
    getRecentSearches,
    RECENT_SEARCHES_STORAGE_KEY,
    relabelRecentSearches,
    removeRecentSearch,
} from '@/entities/ticker';
import { getAssetLabelsAction } from '@/entities/ticker/actions';

interface UseRecentSearchesResult {
    recentSearches: RecentSearchEntry[];
    /** 표시용 회사명을 아는 호출부는 `{ symbol, label }`을 넘긴다. */
    addSearch: (entry: string | RecentSearchEntry) => void;
    removeSearch: (symbol: string) => void;
    clearAll: () => void;
}

const RECENT_SEARCHES_EVENT = 'siglens:recent-searches-change';
const EMPTY: RecentSearchEntry[] = [];

let cachedSnapshot: RecentSearchEntry[] = EMPTY;
let cacheKey = '';

function getSnapshot(): RecentSearchEntry[] {
    const next = getRecentSearches();
    // `useSyncExternalStore`는 참조 동일성으로 재렌더를 정한다 — 매 호출마다 새
    // 배열을 돌려주면 무한 루프가 된다. 심볼+라벨을 합쳐 키를 만든다.
    const key = next.map(e => `${e.symbol}\u0000${e.label}`).join('|');
    if (key !== cacheKey) {
        cachedSnapshot = next;
        cacheKey = key;
    }
    return cachedSnapshot;
}

function getServerSnapshot(): RecentSearchEntry[] {
    return EMPTY;
}

function subscribe(callback: () => void): () => void {
    if (typeof window === 'undefined') {
        return () => {};
    }
    const handleStorage = (event: StorageEvent) => {
        if (event.key === RECENT_SEARCHES_STORAGE_KEY) {
            callback();
        }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener(RECENT_SEARCHES_EVENT, callback);
    return () => {
        window.removeEventListener('storage', handleStorage);
        window.removeEventListener(RECENT_SEARCHES_EVENT, callback);
    };
}

function notify(): void {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(RECENT_SEARCHES_EVENT));
    }
}

/**
 * 이미 조회를 시도한 심볼. **로드당** 한 번으로 묶는다.
 *
 * 이름을 찾지 못한 심볼(FMP가 색인하지 않는 종목)은 라벨이 심볼로 남으므로,
 * 이 기록이 없으면 마운트할 때마다 같은 조회를 되풀이한다 — 오버레이는 열 때마다
 * 마운트된다.
 */
const requestedLabelSymbols = new Set<string>();

/**
 * 라벨이 심볼과 같은 항목의 회사명을 한 번 조회해 채운다.
 *
 * 이 상태로 저장된 항목은 두 경로에서 온다 — v1(`string[]`) 저장값 승격과, 검색
 * 결과 없이 친 티커로 직행한 경우. 둘 다 사용자에게는 `005930.KS`로만 보이고
 * 그 종목을 **다시 검색하기 전까지** 고쳐지지 않는다.
 *
 * 실패는 삼킨다. 칩에 티커가 보이는 것은 이미 지금 상태이고, 표시용 이름 하나
 * 때문에 오류 예산(`reportClientError`, 로드당 5건)을 태울 이유가 없다.
 */
function useCompanyNameBackfill(entries: RecentSearchEntry[]): void {
    useEffect(() => {
        const pending = entries
            .filter(
                entry =>
                    entry.label === entry.symbol &&
                    !requestedLabelSymbols.has(entry.symbol)
            )
            .map(entry => entry.symbol);
        if (pending.length === 0) return;

        // 요청 **전에** 표시한다. 응답을 기다리는 사이 다시 마운트되면 같은
        // 조회가 두 번 나간다.
        pending.forEach(symbol => requestedLabelSymbols.add(symbol));

        let cancelled = false;
        void getAssetLabelsAction(pending)
            .then(labels => {
                if (cancelled || Object.keys(labels).length === 0) return;
                relabelRecentSearches(labels);
                notify();
            })
            .catch(() => {});

        return () => {
            cancelled = true;
        };
    }, [entries]);
}

export function useRecentSearches(): UseRecentSearchesResult {
    const recentSearches = useSyncExternalStore(
        subscribe,
        getSnapshot,
        getServerSnapshot
    );
    useCompanyNameBackfill(recentSearches);

    const addSearch = useCallback((entry: string | RecentSearchEntry) => {
        addRecentSearch(entry);
        notify();
    }, []);

    const removeSearch = useCallback((symbol: string) => {
        removeRecentSearch(symbol);
        notify();
    }, []);

    const clearAll = useCallback(() => {
        clearRecentSearches();
        notify();
    }, []);

    return { recentSearches, addSearch, removeSearch, clearAll };
}
