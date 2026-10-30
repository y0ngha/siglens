'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { LOCAL_STORAGE_RECENT_SYMBOLS_KEY } from '@/shared/lib/storageKeys';
import {
    readRecentSymbols,
    recordRecentSymbol,
    type RecentSymbolEntry,
} from '../lib/recentSymbols';
import { createStorageListStore } from '../lib/storageListStore';

/** `useRecentSymbols`의 반환값. `record`는 참조가 안정적이다. */
export interface UseRecentSymbolsResult {
    /** 최근 본 순. 서버 렌더·하이드레이션 전에는 빈 목록이다. */
    entries: RecentSymbolEntry[];
    record: (entry: { symbol: string; label: string }) => void;
}

/**
 * 같은 탭에서 최근 본 종목 저장값이 바뀌었음을 알리는 이벤트 이름. `storage` 이벤트는 다른
 * 탭에서만 발생하므로 같은 탭의 구독자는 이 이벤트로 저장값을 다시 읽는다.
 */
const RECENT_SYMBOLS_CHANGE_EVENT = 'siglens:recent-symbols-change';

const store = createStorageListStore<RecentSymbolEntry>({
    storageKey: LOCAL_STORAGE_RECENT_SYMBOLS_KEY,
    eventName: RECENT_SYMBOLS_CHANGE_EVENT,
    read: () => readRecentSymbols(),
    fingerprint: e => `${e.symbol}\u0000${e.label}\u0000${e.viewedAt}`,
});

/**
 * 기기 로컬의 최근 본 종목. 회원·비회원 구분 없이 같은 저장소를 쓴다. 로그아웃해도 지우지 않는다 —
 * 계정 데이터(관심종목)가 아니라 "최근 검색"과 같은 이 기기의 탐색 이력이고, 서버로 보내지 않는다.
 * 개인정보처리방침(v9) 쿠키·로컬 스토리지 항목에 같은 내용으로 고지한다.
 */
export function useRecentSymbols(): UseRecentSymbolsResult {
    const entries = useSyncExternalStore(
        store.subscribe,
        store.getSnapshot,
        store.getServerSnapshot
    );
    const record = useCallback(
        (entry: { symbol: string; label: string }): void => {
            if (recordRecentSymbol(entry, Date.now())) store.notify();
        },
        []
    );
    return { entries, record };
}
