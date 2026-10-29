/**
 * 최근 검색 저장소를 `useSyncExternalStore`에 잇는 어댑터. 저장 자체(`localStorage`
 * 읽기·쓰기·파싱)는 `entities/ticker/lib/recentSearches`가 맡고, 여기서는 구독과
 * 스냅샷 동일성만 다룬다.
 */
import {
    getRecentSearches,
    RECENT_SEARCHES_STORAGE_KEY,
    type RecentSearchEntry,
} from '@/entities/ticker/lib/recentSearches';

/**
 * 같은 탭 안의 변경 알림. `storage` 이벤트는 **다른** 탭에서만 오므로, 이 탭에서 쓴
 * 변경은 이 이벤트로 다른 구독자(히어로 칩·오버레이)에 알린다.
 */
export const RECENT_SEARCHES_EVENT = 'siglens:recent-searches-change';

const EMPTY: RecentSearchEntry[] = [];

let cachedSnapshot: RecentSearchEntry[] = EMPTY;
let cacheKey = '';

/**
 * 현재 최근 검색. 내용이 같으면 **같은 배열**을 돌려준다 — `useSyncExternalStore`는
 * 참조 동일성으로 재렌더를 정하므로 매번 새 배열을 주면 무한 루프가 된다. 라벨만 바뀌어도
 * 칩이 갱신돼야 하므로 키에 심볼과 라벨을 함께 넣는다.
 */
export function getRecentSearchesSnapshot(): RecentSearchEntry[] {
    const next = getRecentSearches();
    const key = next.map(e => `${e.symbol}\u0000${e.label}`).join('|');
    if (key !== cacheKey) {
        cachedSnapshot = next;
        cacheKey = key;
    }
    return cachedSnapshot;
}

/** 서버·하이드레이션 렌더의 스냅샷. 서버에는 `localStorage`가 없으므로 늘 비어 있다. */
export function getServerRecentSearchesSnapshot(): RecentSearchEntry[] {
    return EMPTY;
}

/**
 * 다른 탭의 `storage` 이벤트가 최근 검색에 영향을 주는지.
 *
 * `key === null`은 다른 탭이 `localStorage.clear()`를 불렀다는 뜻이다(HTML 명세). 그때도
 * 최근 검색이 사라졌으므로 다시 읽어야 한다 — 저장 키만 보면 이 탭의 칩이 지워진 항목을
 * 계속 보여 준다.
 */
export function affectsRecentSearches(event: StorageEvent): boolean {
    return event.key === null || event.key === RECENT_SEARCHES_STORAGE_KEY;
}

/** `useSyncExternalStore`의 구독. 다른 탭의 저장소 변경과 이 탭의 변경 알림을 함께 듣는다. */
export function subscribeRecentSearches(callback: () => void): () => void {
    if (typeof window === 'undefined') {
        return () => {};
    }
    const handleStorage = (event: StorageEvent) => {
        if (affectsRecentSearches(event)) callback();
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener(RECENT_SEARCHES_EVENT, callback);
    return () => {
        window.removeEventListener('storage', handleStorage);
        window.removeEventListener(RECENT_SEARCHES_EVENT, callback);
    };
}

/** 이 탭에서 최근 검색을 바꾼 뒤 구독자에게 알린다. */
export function notifyRecentSearchesChange(): void {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(RECENT_SEARCHES_EVENT));
    }
}
