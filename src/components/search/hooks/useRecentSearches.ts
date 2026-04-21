'use client';

import { useCallback, useSyncExternalStore } from 'react';

import {
    addRecentSearch,
    clearRecentSearches,
    getRecentSearches,
    RECENT_SEARCHES_STORAGE_KEY,
    removeRecentSearch,
} from '@/infrastructure/storage/recentSearches';

interface UseRecentSearchesResult {
    recentSearches: string[];
    addSearch: (symbol: string) => void;
    removeSearch: (symbol: string) => void;
    clearAll: () => void;
}

const RECENT_SEARCHES_EVENT = 'siglens:recent-searches-change';
const EMPTY: string[] = [];

let cachedSnapshot: string[] = EMPTY;
let cacheKey = '';

function getSnapshot(): string[] {
    const next = getRecentSearches();
    const key = next.join('|');
    if (key !== cacheKey) {
        cachedSnapshot = next;
        cacheKey = key;
    }
    return cachedSnapshot;
}

function getServerSnapshot(): string[] {
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

    const addSearch = useCallback((symbol: string) => {
        addRecentSearch(symbol);
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
