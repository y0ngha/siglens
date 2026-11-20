// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    VISIT_HISTORY_STORAGE_KEY,
    claimVisitSignals,
} from '@/features/visitor-ping/lib/visitHistoryStorage';

describe('VISIT_HISTORY_STORAGE_KEY', () => {
    it('방침 v15가 고지한 키다', () => {
        expect(VISIT_HISTORY_STORAGE_KEY).toBe('siglens:visit-history:v1');
    });
});

describe('claimVisitSignals', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('첫 방문은 이력을 쓰고 new를 돌려준다', () => {
        expect(claimVisitSignals('2026-11-20')).toEqual({
            first: 'new',
            last: 'none',
            days: 'n1',
            window: null,
        });
        expect(
            JSON.parse(
                window.localStorage.getItem(VISIT_HISTORY_STORAGE_KEY) ?? 'null'
            )
        ).toEqual({
            first: '2026-11-20',
            prev: null,
            last: '2026-11-20',
            days: 1,
        });
    });

    it('같은 날 다시 불러도 다시 쓰지 않고 같은 값을 돌려준다', () => {
        const first = claimVisitSignals('2026-11-20');
        const setItem = vi.spyOn(Storage.prototype, 'setItem');
        expect(claimVisitSignals('2026-11-20')).toEqual(first);
        expect(setItem).not.toHaveBeenCalled();
    });

    it('다음 날은 d1 창으로 센다', () => {
        claimVisitSignals('2026-11-20');
        expect(claimVisitSignals('2026-11-21')).toEqual({
            first: 'd1_6',
            last: 'd1',
            days: 'n2',
            window: 'd1',
        });
    });

    it('기기 시계가 과거로 갔다 오면 null이고 이력을 다시 쓰지 않는다', () => {
        claimVisitSignals('2026-11-20');
        claimVisitSignals('2026-11-25');
        const before = window.localStorage.getItem(VISIT_HISTORY_STORAGE_KEY);
        const setItem = vi.spyOn(Storage.prototype, 'setItem');
        expect(claimVisitSignals('2026-11-22')).toBeNull();
        expect(setItem).not.toHaveBeenCalled();
        expect(window.localStorage.getItem(VISIT_HISTORY_STORAGE_KEY)).toBe(
            before
        );
    });

    it('getItem이 던지면 null이다', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        expect(claimVisitSignals('2026-11-20')).toBeNull();
    });

    it('setItem이 던지면 null이다(저장 못 하는 브라우저를 매일 new로 보고하지 않는다)', () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('quota');
        });
        expect(claimVisitSignals('2026-11-20')).toBeNull();
    });

    it('깨진 값은 첫 방문으로 다루고 덮어쓴다', () => {
        window.localStorage.setItem(VISIT_HISTORY_STORAGE_KEY, '{broken');
        expect(claimVisitSignals('2026-11-20')?.first).toBe('new');
        expect(
            JSON.parse(
                window.localStorage.getItem(VISIT_HISTORY_STORAGE_KEY) ?? 'null'
            )
        ).toMatchObject({ days: 1 });
    });
});
