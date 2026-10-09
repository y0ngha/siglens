import { SESSION_STORAGE_WATCHLIST_MERGED_KEY } from '@/shared/lib/storageKeys';

/** 한 탭 세션에 병합은 한 번. 성공했을 때만 적는다 — 실패하면 다음 페이지에서 다시 시도한다(§5). */
export function hasWatchlistMergedThisSession(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        return (
            sessionStorage.getItem(SESSION_STORAGE_WATCHLIST_MERGED_KEY) === '1'
        );
    } catch {
        return false;
    }
}

export function markWatchlistMergedThisSession(): void {
    if (typeof window === 'undefined') return;
    try {
        sessionStorage.setItem(SESSION_STORAGE_WATCHLIST_MERGED_KEY, '1');
    } catch {
        // storage blocked — 같은 세션에 한 번 더 병합을 시도할 뿐이고, 서버는 멱등이다.
    }
}
