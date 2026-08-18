'use client';

import { useCallback, useSyncExternalStore } from 'react';

import type { RecentSearchEntry } from '@/entities/ticker';
import {
    addRecentSearch,
    clearRecentSearches,
    getRecentSearches,
    RECENT_SEARCHES_STORAGE_KEY,
    removeRecentSearch,
} from '@/entities/ticker';

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

export function useRecentSearches(): UseRecentSearchesResult {
    const recentSearches = useSyncExternalStore(
        subscribe,
        getSnapshot,
        getServerSnapshot
    );

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
