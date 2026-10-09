import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installLegacyBrowserPolyfills } from '@/shared/lib/legacyBrowserPolyfills';

/**
 * 구형 브라우저처럼 지운 뒤 설치해 시험하고, 원래 메서드를 되돌린다.
 * e2e `legacy-browser.spec.ts`의 삭제 목록과 같은 대상이다 — 폴리필을 늘리면 둘 다 고친다.
 */
const TARGETS: readonly [object, string][] = [
    [Array.prototype, 'toSorted'],
    [Array.prototype, 'toReversed'],
    [Array.prototype, 'findLast'],
    [Array.prototype, 'findLastIndex'],
    [Array.prototype, 'at'],
    [String.prototype, 'at'],
    [Object, 'hasOwn'],
    [AbortSignal, 'timeout'],
];

/** 함수가 아닌 콜백 — 명세상 TypeError가 나야 하는 입력이다. */
const NOT_A_FUNCTION = 'x' as unknown as () => boolean;

const originals = TARGETS.map(
    ([target, name]) =>
        [target, name, Object.getOwnPropertyDescriptor(target, name)] as const
);

beforeEach(() => {
    for (const [target, name] of TARGETS) {
        // 내장 객체에서 이름으로 지우기 위한 좁히기 — 값은 바꾸지 않는다.
        delete (target as Record<string, unknown>)[name];
    }
    installLegacyBrowserPolyfills();
});

afterEach(() => {
    vi.useRealTimers();
    for (const [target, name, descriptor] of originals) {
        if (descriptor) Object.defineProperty(target, name, descriptor);
    }
});

describe('toSorted', () => {
    it('원본을 바꾸지 않고 정렬한 사본을 돌려준다', () => {
        const source = [3, 1, 2];
        expect(source.toSorted((a, b) => a - b)).toEqual([1, 2, 3]);
        expect(source).toEqual([3, 1, 2]);
    });

    it('비교 함수가 없으면 기본(문자열) 정렬이다', () => {
        expect([10, 9, 1].toSorted()).toEqual([1, 10, 9]);
    });

    it('빈 칸을 undefined로 채운다', () => {
        const sparse: (number | undefined)[] = [3];
        sparse[2] = 1;
        expect(sparse.toSorted()).toEqual([1, 3, undefined]);
    });

    it('함수가 아닌 비교자는 TypeError다', () => {
        expect(() =>
            [1].toSorted('x' as unknown as (a: number, b: number) => number)
        ).toThrow(TypeError);
    });
});

describe('toReversed', () => {
    it('원본을 바꾸지 않는다', () => {
        const source = [1, 2, 3];
        expect(source.toReversed()).toEqual([3, 2, 1]);
        expect(source).toEqual([1, 2, 3]);
    });
});

describe('findLast', () => {
    it('뒤에서부터 찾은 첫 값을 돌려준다', () => {
        expect([1, 2, 3, 2].findLast(v => v === 2)).toBe(2);
    });

    it('없으면 undefined', () => {
        expect([1, 2].findLast(v => v > 5)).toBeUndefined();
    });

    it('thisArg를 predicate의 this로 넘긴다', () => {
        const found = [1, 2, 3].findLast(
            function (this: { target: number }, v) {
                return v === this.target;
            },
            { target: 2 }
        );
        expect(found).toBe(2);
    });

    it('함수가 아닌 predicate는 TypeError다', () => {
        expect(() => [1].findLast(NOT_A_FUNCTION)).toThrow(TypeError);
    });
});

describe('findLastIndex', () => {
    it('뒤에서부터 찾은 첫 인덱스를 돌려준다', () => {
        expect([1, 2, 3, 2].findLastIndex(v => v === 2)).toBe(3);
    });

    it('없으면 -1', () => {
        expect([1, 2].findLastIndex(v => v > 5)).toBe(-1);
    });

    it('함수가 아닌 predicate는 TypeError다', () => {
        expect(() => [1].findLastIndex(NOT_A_FUNCTION)).toThrow(TypeError);
    });
});

describe('Array.prototype.at', () => {
    it('음수 인덱스를 뒤에서 센다', () => {
        expect([1, 2, 3].at(-1)).toBe(3);
    });

    it('범위 밖이면 undefined', () => {
        expect([1, 2, 3].at(5)).toBeUndefined();
        expect([1, 2, 3].at(-4)).toBeUndefined();
    });

    it('NaN·소수는 0 쪽으로 자른다', () => {
        expect([1, 2, 3].at(Number.NaN)).toBe(1);
        expect([1, 2, 3].at(1.7)).toBe(2);
    });
});

describe('String.prototype.at', () => {
    it('음수 인덱스를 뒤에서 센다', () => {
        expect('abc'.at(-1)).toBe('c');
    });

    it('범위 밖이면 undefined', () => {
        expect('abc'.at(3)).toBeUndefined();
    });
});

describe('Object.hasOwn', () => {
    it('자기 속성만 본다', () => {
        expect(Object.hasOwn({ a: 1 }, 'a')).toBe(true);
        expect(Object.hasOwn({ a: 1 }, 'toString')).toBe(false);
    });
});

describe('AbortSignal.timeout', () => {
    it('지정한 시간이 지나면 TimeoutError로 중단된다', () => {
        vi.useFakeTimers();
        const signal = AbortSignal.timeout(1_000);
        expect(signal.aborted).toBe(false);

        vi.advanceTimersByTime(1_000);

        expect(signal.aborted).toBe(true);
        expect((signal.reason as DOMException).name).toBe('TimeoutError');
    });
});

describe('설치 동작', () => {
    it('새로 채운 메서드는 for…in에 나오지 않는다', () => {
        const keys: string[] = [];
        for (const key in [1]) keys.push(key);
        expect(keys).toEqual(['0']);
    });

    it('이미 있는 메서드는 덮지 않는다', () => {
        const native = (): number[] => [42];
        Object.defineProperty(Array.prototype, 'toSorted', {
            value: native,
            writable: true,
            configurable: true,
        });
        installLegacyBrowserPolyfills();
        expect([1].toSorted()).toEqual([42]);
    });
});
