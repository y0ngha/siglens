interface StorageListStoreOptions<T> {
    /** 다른 탭의 `storage` 이벤트 중 이 키(또는 `clear()`의 null)만 변경으로 본다. */
    storageKey: string;
    /** 같은 탭에서 쓴 뒤 `notify()`가 쏘는 이벤트 이름. `storage` 이벤트는 쓴 탭에는 오지 않는다. */
    eventName: string;
    /** 저장소에서 목록을 새로 읽는다(방어적 파서). */
    read: () => T[];
    /** 항목 내용의 지문. 지문이 같으면 같은 배열을 돌려준다. */
    fingerprint: (entry: T) => string;
}

/** `useSyncExternalStore`에 그대로 넘기는 세 함수와, 같은 탭의 구독자를 깨우는 `notify`. */
export interface StorageListStore<T> {
    subscribe: (callback: () => void) => () => void;
    getSnapshot: () => T[];
    getServerSnapshot: () => T[];
    notify: () => void;
}

/**
 * localStorage에 든 목록을 `useSyncExternalStore`로 읽는 외부 저장소. 관심종목(비회원)과
 * 최근 본 종목이 같은 모양으로 쓴다. `useSyncExternalStore`는 참조 동일성으로 재렌더를
 * 정하므로 내용이 같으면 같은 배열을 돌려줘야 무한 루프가 나지 않는다 — 지문으로 캐시한다.
 * 서버 스냅샷은 빈 목록이라 하이드레이션 뒤 저장값으로 한 번 바뀐다.
 */
export function createStorageListStore<T>({
    storageKey,
    eventName,
    read,
    fingerprint,
}: StorageListStoreOptions<T>): StorageListStore<T> {
    const empty: T[] = [];
    let cachedSnapshot = empty;
    let cacheKey = '';

    const getSnapshot = (): T[] => {
        const next = read();
        const key = next.map(fingerprint).join('|');
        if (key !== cacheKey) {
            cachedSnapshot = next;
            cacheKey = key;
        }
        return cachedSnapshot;
    };

    const subscribe = (callback: () => void): (() => void) => {
        if (typeof window === 'undefined') return () => {};
        const handleStorage = (event: StorageEvent): void => {
            // key === null: 다른 탭의 `localStorage.clear()`.
            if (event.key === null || event.key === storageKey) callback();
        };
        window.addEventListener('storage', handleStorage);
        window.addEventListener(eventName, callback);
        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener(eventName, callback);
        };
    };

    const notify = (): void => {
        if (typeof window !== 'undefined')
            window.dispatchEvent(new Event(eventName));
    };

    return {
        subscribe,
        getSnapshot,
        getServerSnapshot: () => empty,
        notify,
    };
}
