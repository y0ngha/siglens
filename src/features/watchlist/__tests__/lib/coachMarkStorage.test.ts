// @vitest-environment jsdom
import {
    hasSeenWatchlistCoachMark,
    markWatchlistCoachMarkSeen,
} from '@/features/watchlist/lib/coachMarkStorage';
import { LOCAL_STORAGE_WATCHLIST_COACH_SEEN_KEY } from '@/shared/lib/storageKeys';

describe('coachMarkStorage', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('처음엔 false, mark 뒤엔 true', () => {
        expect(hasSeenWatchlistCoachMark()).toBe(false);
        markWatchlistCoachMarkSeen();
        expect(hasSeenWatchlistCoachMark()).toBe(true);
        expect(
            localStorage.getItem(LOCAL_STORAGE_WATCHLIST_COACH_SEEN_KEY)
        ).toBe('1');
    });

    it('저장소가 던지면 false로 본다(사파리 개인정보 보호 모드)', () => {
        const spy = vi
            .spyOn(Storage.prototype, 'getItem')
            .mockImplementation(() => {
                throw new Error('blocked');
            });
        expect(hasSeenWatchlistCoachMark()).toBe(false);
        spy.mockRestore();
    });
});
