import { LOCAL_STORAGE_WATCHLIST_COACH_SEEN_KEY } from '@/shared/lib/storageKeys';

/** 코치 마크는 방문자당 한 번이다. 저장소가 막혀 있으면 "아직 안 봄" — 최악의 경우 한 번 더 뜰 뿐이다. */
export function hasSeenWatchlistCoachMark(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        return (
            localStorage.getItem(LOCAL_STORAGE_WATCHLIST_COACH_SEEN_KEY) === '1'
        );
    } catch {
        return false;
    }
}

export function markWatchlistCoachMarkSeen(): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(LOCAL_STORAGE_WATCHLIST_COACH_SEEN_KEY, '1');
    } catch {
        // storage blocked
    }
}
