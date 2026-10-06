import { describe, expect, it } from 'vitest';
import {
    __resetMemoryLruForTests,
    createMemoryLru,
} from '@/shared/cache/memoryLru';

function clock(start = 1_000) {
    let t = start;
    return {
        now: () => t,
        advance: (ms: number) => {
            t += ms;
        },
    };
}

describe('createMemoryLru', () => {
    it('저장한 값을 TTL 동안 돌려준다', () => {
        const c = clock();
        const lru = createMemoryLru<string>(2, c.now);
        lru.set('a', 'A', 100);
        expect(lru.get('a')).toBe('A');
        c.advance(99);
        expect(lru.get('a')).toBe('A');
    });

    it('만료 시각이 되면 없는 것으로 보고 지운다', () => {
        const c = clock();
        const lru = createMemoryLru<string>(2, c.now);
        lru.set('a', 'A', 100);
        c.advance(100);
        expect(lru.get('a')).toBeUndefined();
        // 다시 읽어도 undefined — 만료 항목이 되살아나지 않는다.
        expect(lru.get('a')).toBeUndefined();
    });

    it('없는 키는 undefined', () => {
        const lru = createMemoryLru<string>(2);
        expect(lru.get('missing')).toBeUndefined();
    });

    it('TTL이 0 이하면 저장하지 않고 기존 값도 지운다', () => {
        const lru = createMemoryLru<string>(2);
        lru.set('a', 'A', 100);
        lru.set('a', 'B', 0);
        expect(lru.get('a')).toBeUndefined();
        lru.set('b', 'B', -1);
        expect(lru.get('b')).toBeUndefined();
    });

    it('상한을 넘으면 가장 오래 안 쓴 항목을 버린다', () => {
        const lru = createMemoryLru<string>(2);
        lru.set('a', 'A', 1_000);
        lru.set('b', 'B', 1_000);
        // a를 읽어 최근 사용으로 옮긴다 → 다음에 밀려나는 건 b.
        expect(lru.get('a')).toBe('A');
        lru.set('c', 'C', 1_000);
        expect(lru.get('b')).toBeUndefined();
        expect(lru.get('a')).toBe('A');
        expect(lru.get('c')).toBe('C');
    });

    it('같은 키를 다시 쓰면 값과 만료를 갱신하고 개수는 늘지 않는다', () => {
        const c = clock();
        const lru = createMemoryLru<string>(2, c.now);
        lru.set('a', 'A', 100);
        lru.set('b', 'B', 1_000);
        c.advance(50);
        lru.set('a', 'A2', 100);
        c.advance(60);
        expect(lru.get('a')).toBe('A2');
        expect(lru.get('b')).toBe('B');
    });

    it('테스트 리셋은 모든 항목을 비운다', () => {
        const lru = createMemoryLru<string>(2);
        lru.set('a', 'A', 1_000);
        __resetMemoryLruForTests(lru);
        expect(lru.get('a')).toBeUndefined();
    });
});
