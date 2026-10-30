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
import { createStorageListStore } from '../lib/storageListStore';

/** `useLocalWatchlist`의 반환값. 쓰기 함수는 참조가 안정적이다. */
export interface UseLocalWatchlistResult {
    entries: LocalWatchlistEntry[];
    /** 들어갔으면 true. 이미 있거나 상한이면 false. */
    add: (entry: { symbol: string; label: string }) => boolean;
    /** 저장까지 끝났으면 true. 저장소가 막혀 있으면 false. */
    remove: (symbol: string) => boolean;
    clear: () => void;
}

/**
 * 같은 탭에서 관심종목 저장값이 바뀌었음을 알리는 이벤트 이름. `storage` 이벤트는 다른 탭에서만
 * 발생하므로, 같은 탭의 구독자는 이 이벤트로 저장값을 다시 읽는다. 값은 영속 계약이라 바꾸지 않는다.
 */
const WATCHLIST_CHANGE_EVENT = 'siglens:watchlist-change';

const store = createStorageListStore<LocalWatchlistEntry>({
    storageKey: LOCAL_STORAGE_WATCHLIST_KEY,
    eventName: WATCHLIST_CHANGE_EVENT,
    read: () => readLocalWatchlist(),
    fingerprint: e => `${e.symbol}\u0000${e.label}\u0000${e.addedAt}`,
});

/** 비회원 관심종목. 서버 스냅샷은 빈 목록 — 하이드레이션 뒤 저장값으로 한 번 바뀐다. */
export function useLocalWatchlist(): UseLocalWatchlistResult {
    const entries = useSyncExternalStore(
        store.subscribe,
        store.getSnapshot,
        store.getServerSnapshot
    );

    const add = useCallback(
        (entry: { symbol: string; label: string }): boolean => {
            const { added } = addLocalWatchlistEntry(entry, Date.now());
            if (added) store.notify();
            return added;
        },
        []
    );
    const remove = useCallback((symbol: string): boolean => {
        const { removed } = removeLocalWatchlistEntry(symbol);
        if (removed) store.notify();
        return removed;
    }, []);
    const clear = useCallback((): void => {
        clearLocalWatchlist();
        store.notify();
    }, []);

    return { entries, add, remove, clear };
}
