// @vitest-environment jsdom
import {
    hasWatchlistMergedThisSession,
    markWatchlistMergedThisSession,
} from '@/features/watchlist/lib/mergeSession';
import { SESSION_STORAGE_WATCHLIST_MERGED_KEY } from '@/shared/lib/storageKeys';

describe('mergeSession', () => {
    beforeEach(() => {
        sessionStorage.clear();
    });

    it('처음엔 false, mark 뒤엔 true(sessionStorage)', () => {
        expect(hasWatchlistMergedThisSession()).toBe(false);
        markWatchlistMergedThisSession();
        expect(hasWatchlistMergedThisSession()).toBe(true);
        expect(
            sessionStorage.getItem(SESSION_STORAGE_WATCHLIST_MERGED_KEY)
        ).toBe('1');
    });
});
