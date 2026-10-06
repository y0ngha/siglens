import { describe, it, expect, afterEach, vi } from 'vitest';
import { createBoundedLru, readPositiveBound } from '../boundedLru.mjs';

function manualClock(start = 1_000) {
    let now = start;
    return {
        clock: () => now,
        advance: ms => {
            now += ms;
        },
    };
}

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('readPositiveBound', () => {
    it('양의 유한값만 받는다', () => {
        vi.stubEnv('LRU_TEST_BOUND', '42');
        expect(readPositiveBound('LRU_TEST_BOUND', 7)).toBe(42);
    });

    it.each(['0', '-5', 'abc', ''])(
        '%j는 기본값으로 떨어진다(음수가 통과하면 매 set마다 맵이 비워진다)',
        raw => {
            vi.stubEnv('LRU_TEST_BOUND', raw);
            expect(readPositiveBound('LRU_TEST_BOUND', 7)).toBe(7);
        }
    );
});

describe('createBoundedLru', () => {
    it('TTL이 지나면 miss이고 예산에서 빠진다', () => {
        const { clock, advance } = manualClock();
        const lru = createBoundedLru({ maxEntries: 10, ttlMs: 100, clock });
        lru.set('a', 'A', 5);
        advance(99);
        expect(lru.get('a')).toBe('A');
        advance(1);
        expect(lru.get('a')).toBeUndefined();
        expect(lru.stats()).toMatchObject({ size: 0, totalBytes: 0 });
    });

    it('개수 상한을 넘으면 가장 오래 안 쓴 항목부터 축출한다', () => {
        const lru = createBoundedLru({ maxEntries: 2, ttlMs: 1_000 });
        lru.set('a', 'A');
        lru.set('b', 'B');
        lru.get('a'); // a를 최근으로
        lru.set('c', 'C');
        expect(lru.get('b')).toBeUndefined();
        expect(lru.get('a')).toBe('A');
        expect(lru.get('c')).toBe('C');
        expect(lru.stats().evictions).toBe(1);
    });

    it('바이트 예산을 넘으면 오래된 항목부터 축출한다', () => {
        const lru = createBoundedLru({
            maxEntries: 100,
            maxBytes: 10,
            ttlMs: 1_000,
        });
        lru.set('a', 'A', 6);
        lru.set('b', 'B', 6);
        expect(lru.get('a')).toBeUndefined();
        expect(lru.stats().totalBytes).toBe(6);
    });

    it('예산보다 큰 항목은 거부하고 같은 키의 옛 값을 지운다', () => {
        const lru = createBoundedLru({
            maxEntries: 100,
            maxBytes: 10,
            ttlMs: 1_000,
        });
        lru.set('a', 'old', 3);
        expect(lru.set('a', 'huge', 11)).toBe(false);
        expect(lru.get('a')).toBeUndefined();
        expect(lru.stats().totalBytes).toBe(0);
    });

    it('덮어쓰기는 옛 크기를 빼고 다시 센다', () => {
        const lru = createBoundedLru({ maxEntries: 10, ttlMs: 1_000 });
        lru.set('a', 'A', 4);
        lru.set('a', 'A2', 7);
        expect(lru.stats()).toMatchObject({ size: 1, totalBytes: 7 });
    });

    it('delete와 clear', () => {
        const lru = createBoundedLru({ maxEntries: 10, ttlMs: 1_000 });
        lru.set('a', 'A', 1);
        lru.set('b', 'B', 1);
        lru.delete('a');
        lru.delete('missing');
        expect(lru.get('a')).toBeUndefined();
        lru.clear();
        expect(lru.stats()).toEqual({ size: 0, totalBytes: 0, evictions: 0 });
    });
});
