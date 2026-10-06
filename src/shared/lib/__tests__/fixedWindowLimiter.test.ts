import { describe, expect, it } from 'vitest';
import {
    __resetFixedWindowLimiterForTests,
    createFixedWindowLimiter,
} from '@/shared/lib/fixedWindowLimiter';

const WINDOW_MS = 1000;

function limiter(limit = 3, maxTrackedKeys = 100) {
    return createFixedWindowLimiter({
        limit,
        windowMs: WINDOW_MS,
        maxTrackedKeys,
    });
}

describe('createFixedWindowLimiter', () => {
    it('창 안에서 상한까지 받고 그다음부터 거절한다', () => {
        const l = limiter(3);

        expect([1, 2, 3, 4].map(() => l.admit('a', 0))).toEqual([
            true,
            true,
            true,
            false,
        ]);
    });

    it('창은 첫 요청 시각부터 고정이다 — 중간 요청이 창을 늘리지 않는다', () => {
        const l = limiter(2);
        l.admit('a', 0);
        l.admit('a', WINDOW_MS - 1);
        expect(l.admit('a', WINDOW_MS - 1)).toBe(false);

        expect(l.admit('a', WINDOW_MS)).toBe(true);
    });

    it('키마다 따로 센다', () => {
        const l = limiter(1);

        expect(l.admit('a', 0)).toBe(true);
        expect(l.admit('a', 0)).toBe(false);
        expect(l.admit('b', 0)).toBe(true);
    });

    it('추적 키 수를 넘으면 가장 오래 안 쓴 키부터 잊는다', () => {
        const l = limiter(1, 2);
        l.admit('a', 0);
        l.admit('b', 0);
        l.admit('c', 0);

        // 'a'는 밀려났으므로 새 창으로 받는다.
        expect(l.admit('a', 0)).toBe(true);
        expect(l.admit('c', 0)).toBe(false);
    });

    it('테스트 리셋은 그 인스턴스의 카운트만 비운다', () => {
        const l1 = limiter(1);
        const l2 = limiter(1);
        l1.admit('a', 0);
        l2.admit('a', 0);

        __resetFixedWindowLimiterForTests(l1);

        expect(l1.admit('a', 0)).toBe(true);
        expect(l2.admit('a', 0)).toBe(false);
    });
});
