// @vitest-environment jsdom
import { RECENT_SEARCHES_STORAGE_KEY } from '@/entities/ticker/lib/recentSearches';
import {
    affectsRecentSearches,
    RECENT_SEARCHES_EVENT,
    subscribeRecentSearches,
} from '@/features/ticker-search/lib/recentSearchesStore';

describe('affectsRecentSearches', () => {
    it('최근 검색 저장 키의 변경은 반영한다', () => {
        expect(
            affectsRecentSearches(
                new StorageEvent('storage', {
                    key: RECENT_SEARCHES_STORAGE_KEY,
                })
            )
        ).toBe(true);
    });

    it('다른 탭의 localStorage.clear()(key === null)도 반영한다', () => {
        // 저장 키만 보면 다른 탭이 저장소를 비워도 이 탭의 칩이 남는다.
        expect(
            affectsRecentSearches(new StorageEvent('storage', { key: null }))
        ).toBe(true);
    });

    it('무관한 키의 변경은 무시한다', () => {
        expect(
            affectsRecentSearches(
                new StorageEvent('storage', { key: 'some_other_key' })
            )
        ).toBe(false);
    });
});

describe('subscribeRecentSearches', () => {
    it('다른 탭이 저장소를 비우면 구독자를 부른다', () => {
        const callback = vi.fn();
        const unsubscribe = subscribeRecentSearches(callback);
        window.dispatchEvent(new StorageEvent('storage', { key: null }));
        unsubscribe();
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('해제한 뒤에는 알림을 받지 않는다', () => {
        const callback = vi.fn();
        subscribeRecentSearches(callback)();
        window.dispatchEvent(new Event(RECENT_SEARCHES_EVENT));
        expect(callback).not.toHaveBeenCalled();
    });
});
