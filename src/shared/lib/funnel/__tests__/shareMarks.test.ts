// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    claimShareCreated,
    claimShareOpened,
} from '@/shared/lib/funnel/shareMarks';
import { LOCAL_STORAGE_SHARE_MARKS_KEY } from '@/shared/lib/storageKeys';

const DAY1 = new Date('2026-11-20T03:00:00Z');
const BEFORE_MIDNIGHT = new Date('2026-11-20T14:59:59Z');
const AFTER_MIDNIGHT = new Date('2026-11-20T15:00:00Z');

function stored(): unknown {
    return JSON.parse(
        window.localStorage.getItem(LOCAL_STORAGE_SHARE_MARKS_KEY) ?? 'null'
    );
}

describe('LOCAL_STORAGE_SHARE_MARKS_KEY', () => {
    it('방침 v15가 고지한 키다', () => {
        expect(LOCAL_STORAGE_SHARE_MARKS_KEY).toBe('siglens:share-marks:v1');
    });
});

describe('claimShareCreated', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('같은 id는 한 번만 true다', () => {
        expect(claimShareCreated('a1')).toBe(true);
        expect(claimShareCreated('a1')).toBe(false);
        expect(claimShareCreated('b2')).toBe(true);
    });

    it('최근 20개만 기억한다', () => {
        const ids = Array.from({ length: 21 }, (_, i) => `id-${i}`);
        ids.forEach(id => claimShareCreated(id));
        expect(stored()).toMatchObject({ created: ids.slice(1) });
        // 밀려난 첫 id는 다시 처음으로 센다.
        expect(claimShareCreated('id-0')).toBe(true);
    });

    it('깨진 저장값은 무시하고 새로 기록한다', () => {
        window.localStorage.setItem(LOCAL_STORAGE_SHARE_MARKS_KEY, '{broken');
        expect(claimShareCreated('a1')).toBe(true);
        expect(stored()).toMatchObject({ created: ['a1'] });
    });

    it('모양이 다른 저장값도 무시한다', () => {
        window.localStorage.setItem(
            LOCAL_STORAGE_SHARE_MARKS_KEY,
            JSON.stringify({ created: 'x', opened: null })
        );
        expect(claimShareCreated('a1')).toBe(true);
    });
});

describe('claimShareOpened', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('처음 연 링크는 true, 같은 날 다시 열면 false다', () => {
        expect(claimShareOpened('a1', DAY1)).toBe(true);
        expect(claimShareOpened('a1', BEFORE_MIDNIGHT)).toBe(false);
    });

    it('이 브라우저가 만든 링크를 연 것(자기 열람)은 false다', () => {
        claimShareCreated('mine');
        expect(claimShareOpened('mine', DAY1)).toBe(false);
    });

    it('다른 링크는 따로 센다', () => {
        expect(claimShareOpened('a1', DAY1)).toBe(true);
        expect(claimShareOpened('b2', DAY1)).toBe(true);
    });

    it('KST 자정을 넘기면 다시 true다', () => {
        expect(claimShareOpened('a1', BEFORE_MIDNIGHT)).toBe(true);
        expect(claimShareOpened('a1', AFTER_MIDNIGHT)).toBe(true);
        expect(stored()).toMatchObject({
            opened: { date: '2026-11-21', ids: ['a1'] },
        });
    });

    it('다른 날 남은 opened 목록은 읽는 순간 저장소에서 지운다', () => {
        claimShareOpened('old', DAY1);
        // 다음 날 만들기만 해도(열람 없이) 낡은 열람 목록이 사라진다.
        claimShareCreated('new-created', AFTER_MIDNIGHT);
        expect(stored()).toMatchObject({
            created: ['new-created'],
            opened: { date: '2026-11-21', ids: [] },
        });
    });

    it('바꿀 것이 없는 읽기에서도 낡은 opened를 정리한다', () => {
        claimShareCreated('mine', DAY1);
        claimShareOpened('x', DAY1);
        // 이미 만든 id를 다시 만들어도(null) 낡은 열람 목록은 지운다.
        expect(claimShareCreated('mine', AFTER_MIDNIGHT)).toBe(false);
        expect(stored()).toMatchObject({ opened: { ids: [] } });
    });

    it('연 링크를 기록해도 만든 링크 목록은 지우지 않는다', () => {
        claimShareCreated('mine');
        claimShareOpened('a1', DAY1);
        expect(stored()).toMatchObject({ created: ['mine'] });
    });
});

describe('저장소가 막힌 브라우저', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('페이지 수명 메모리로 중복을 막고 던지지 않는다', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        const when = new Date('2026-12-05T03:00:00Z');
        expect(claimShareCreated('mem-created')).toBe(true);
        expect(claimShareCreated('mem-created')).toBe(false);
        expect(claimShareOpened('mem-created', when)).toBe(false);
        expect(claimShareOpened('mem-opened', when)).toBe(true);
        expect(claimShareOpened('mem-opened', when)).toBe(false);
    });
});
