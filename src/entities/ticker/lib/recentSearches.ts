/**
 * 최근 검색 종목을 LocalStorage에 저장/조회하는 모듈.
 *
 * - 최대 {@link MAX_RECENT_SEARCHES}개까지 저장
 * - 최신 검색이 배열의 앞에 위치
 * - 동일 종목 재검색 시 기존 항목을 제거하고 최상단으로 이동 (중복 방지)
 * - SSR/테스트 환경 호환을 위해 storage 의존성을 주입 가능
 */

export const MAX_RECENT_SEARCHES = 7;
export const RECENT_SEARCHES_STORAGE_KEY = 'siglens:recent-searches';

interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

function getDefaultStorage(): StorageLike | null {
    if (typeof window === 'undefined') {
        return null;
    }
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

function parse(raw: string | null): string[] {
    if (!raw) return [];
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(
            (item): item is string =>
                typeof item === 'string' && item.length > 0
        );
    } catch {
        return [];
    }
}

export function getRecentSearches(
    storage: StorageLike | null = getDefaultStorage()
): string[] {
    if (!storage) return [];
    return parse(storage.getItem(RECENT_SEARCHES_STORAGE_KEY)).slice(
        0,
        MAX_RECENT_SEARCHES
    );
}

export function addRecentSearch(
    symbol: string,
    storage: StorageLike | null = getDefaultStorage()
): string[] {
    const normalized = symbol.trim().toUpperCase();
    if (!normalized) {
        return getRecentSearches(storage);
    }

    const current = getRecentSearches(storage);
    const deduped = current.filter(item => item !== normalized);
    const next = [normalized, ...deduped].slice(0, MAX_RECENT_SEARCHES);

    if (storage) {
        try {
            storage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(next));
        } catch {
            // 저장 실패는 조용히 무시 (quota 초과 등)
        }
    }

    return next;
}

export function removeRecentSearch(
    symbol: string,
    storage: StorageLike | null = getDefaultStorage()
): string[] {
    const normalized = symbol.trim().toUpperCase();
    const current = getRecentSearches(storage);
    const next = current.filter(item => item !== normalized);

    if (storage) {
        try {
            storage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(next));
        } catch {
            // ignore
        }
    }

    return next;
}

export function clearRecentSearches(
    storage: StorageLike | null = getDefaultStorage()
): void {
    if (!storage) return;
    try {
        storage.removeItem(RECENT_SEARCHES_STORAGE_KEY);
    } catch {
        // ignore
    }
}
