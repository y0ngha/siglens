'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { LOCAL_STORAGE_WATCHLIST_KEY } from '@/shared/lib/storageKeys';
import {
    addLocalWatchlistEntry,
    clearLocalWatchlist,
    readLocalWatchlist,
    removeLocalWatchlistEntry,
    type LocalWatchlistEntry,
} from '../lib/localWatchlist';

export interface UseLocalWatchlistResult {
    entries: LocalWatchlistEntry[];
    /** 들어갔으면 true. 이미 있거나 상한이면 false. */
    add: (entry: { symbol: string; label: string }) => boolean;
    /** 저장까지 끝났으면 true. 저장소가 막혀 있으면 false. */
    remove: (symbol: string) => boolean;
    clear: () => void;
}

const WATCHLIST_EVENT = 'siglens:watchlist-change';
const EMPTY: LocalWatchlistEntry[] = [];

let cachedSnapshot: LocalWatchlistEntry[] = EMPTY;
let cacheKey = '';

function getSnapshot(): LocalWatchlistEntry[] {
    const next = readLocalWatchlist();
    // `useSyncExternalStore`는 참조 동일성으로 재렌더를 정한다 — 매 호출마다 새 배열을
    // 돌려주면 무한 루프다(`useRecentSearches`와 같은 캐시).
    const key = next
        .map(e => `${e.symbol}\u0000${e.label}\u0000${e.addedAt}`)
        .join('|');
    if (key !== cacheKey) {
        cachedSnapshot = next;
        cacheKey = key;
    }
    return cachedSnapshot;
}

function getServerSnapshot(): LocalWatchlistEntry[] {
    return EMPTY;
}

function subscribe(callback: () => void): () => void {
    if (typeof window === 'undefined') return () => {};
    const handleStorage = (event: StorageEvent) => {
        // key === null: 다른 탭의 `localStorage.clear()`.
        if (event.key === null || event.key === LOCAL_STORAGE_WATCHLIST_KEY)
            callback();
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener(WATCHLIST_EVENT, callback);
    return () => {
        window.removeEventListener('storage', handleStorage);
        window.removeEventListener(WATCHLIST_EVENT, callback);
    };
}

function notify(): void {
    if (typeof window !== 'undefined')
        window.dispatchEvent(new Event(WATCHLIST_EVENT));
}

/** 비회원 관심종목. 서버 스냅샷은 빈 목록 — 하이드레이션 뒤 저장값으로 한 번 바뀐다. */
export function useLocalWatchlist(): UseLocalWatchlistResult {
    const entries = useSyncExternalStore(
        subscribe,
        getSnapshot,
        getServerSnapshot
    );

    const add = useCallback(
        (entry: { symbol: string; label: string }): boolean => {
            const { added } = addLocalWatchlistEntry(entry, Date.now());
            if (added) notify();
            return added;
        },
        []
    );
    const remove = useCallback((symbol: string): boolean => {
        const { removed } = removeLocalWatchlistEntry(symbol);
        if (removed) notify();
        return removed;
    }, []);
    const clear = useCallback((): void => {
        clearLocalWatchlist();
        notify();
    }, []);

    return { entries, add, remove, clear };
}
