'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { LOCAL_STORAGE_RECENT_SYMBOLS_KEY } from '@/shared/lib/storageKeys';
import {
    readRecentSymbols,
    recordRecentSymbol,
    type RecentSymbolEntry,
} from '../lib/recentSymbols';

export interface UseRecentSymbolsResult {
    /** 최근 본 순. 서버 렌더·하이드레이션 전에는 빈 목록이다. */
    entries: RecentSymbolEntry[];
    record: (entry: { symbol: string; label: string }) => void;
}

const RECENT_SYMBOLS_EVENT = 'siglens:recent-symbols-change';
const EMPTY: RecentSymbolEntry[] = [];

let cachedSnapshot: RecentSymbolEntry[] = EMPTY;
let cacheKey = '';

function getSnapshot(): RecentSymbolEntry[] {
    const next = readRecentSymbols();
    // `useSyncExternalStore`는 참조 동일성으로 재렌더를 정한다 — 내용이 같으면 같은 배열을
    // 돌려줘야 무한 루프가 나지 않는다(`useLocalWatchlist`와 같은 캐시).
    const key = next
        .map(e => `${e.symbol}\u0000${e.label}\u0000${e.viewedAt}`)
        .join('|');
    if (key !== cacheKey) {
        cachedSnapshot = next;
        cacheKey = key;
    }
    return cachedSnapshot;
}

function getServerSnapshot(): RecentSymbolEntry[] {
    return EMPTY;
}

function subscribe(callback: () => void): () => void {
    if (typeof window === 'undefined') return () => {};
    const handleStorage = (event: StorageEvent) => {
        if (
            event.key === null ||
            event.key === LOCAL_STORAGE_RECENT_SYMBOLS_KEY
        )
            callback();
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener(RECENT_SYMBOLS_EVENT, callback);
    return () => {
        window.removeEventListener('storage', handleStorage);
        window.removeEventListener(RECENT_SYMBOLS_EVENT, callback);
    };
}

/**
 * 기기 로컬의 최근 본 종목. 회원·비회원 구분 없이 같은 저장소를 쓴다. 로그아웃해도 지우지 않는다 —
 * 계정 데이터(관심종목)가 아니라 "최근 검색"과 같은 이 기기의 탐색 이력이고, 서버로 보내지 않는다.
 * 개인정보처리방침(v9) 쿠키·로컬 스토리지 항목에 같은 내용으로 고지한다.
 */
export function useRecentSymbols(): UseRecentSymbolsResult {
    const entries = useSyncExternalStore(
        subscribe,
        getSnapshot,
        getServerSnapshot
    );
    const record = useCallback(
        (entry: { symbol: string; label: string }): void => {
            if (recordRecentSymbol(entry, Date.now())) {
                window.dispatchEvent(new Event(RECENT_SYMBOLS_EVENT));
            }
        },
        []
    );
    return { entries, record };
}
