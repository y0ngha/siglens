import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installLegacyBrowserPolyfills } from '@/shared/lib/legacyBrowserPolyfills';

/** 구형 브라우저처럼 지우고 시험한 뒤 원래 메서드를 되돌린다. */
const TARGETS: readonly [object, string][] = [
    [Array.prototype, 'toSorted'],
    [Array.prototype, 'toReversed'],
    [Array.prototype, 'findLast'],
    [Array.prototype, 'findLastIndex'],
    [Array.prototype, 'at'],
    [String.prototype, 'at'],
    [Object, 'hasOwn'],
];

type Legacy = {
    toSorted(compare?: (a: number, b: number) => number): number[];
    toReversed(): number[];
    findLast(predicate: (v: number, i: number) => boolean): number | undefined;
    findLastIndex(predicate: (v: number, i: number) => boolean): number;
    at(index: number): number | undefined;
};

const asLegacy = (arr: number[]): Legacy => arr as unknown as Legacy;

describe('installLegacyBrowserPolyfills', () => {
    const originals = TARGETS.map(
        ([target, name]) =>
            [
                target,
                name,
                Object.getOwnPropertyDescriptor(target, name),
            ] as const
    );

    beforeEach(() => {
        for (const [target, name] of TARGETS) {
            delete (target as Record<string, unknown>)[name];
        }
        installLegacyBrowserPolyfills();
    });

    afterEach(() => {
        for (const [target, name, descriptor] of originals) {
            if (descriptor) Object.defineProperty(target, name, descriptor);
        }
    });

    it('toSorted는 원본을 바꾸지 않고 정렬한 사본을 돌려준다', () => {
        const source = [3, 1, 2];
        expect(asLegacy(source).toSorted((a, b) => a - b)).toEqual([1, 2, 3]);
        expect(source).toEqual([3, 1, 2]);
    });

    it('toSorted는 비교 함수가 없으면 기본(문자열) 정렬이다', () => {
        expect(asLegacy([10, 9, 1]).toSorted()).toEqual([1, 10, 9]);
    });

    it('toReversed는 원본을 바꾸지 않는다', () => {
        const source = [1, 2, 3];
        expect(asLegacy(source).toReversed()).toEqual([3, 2, 1]);
        expect(source).toEqual([1, 2, 3]);
    });

    it('findLast·findLastIndex는 뒤에서부터 찾는다', () => {
        const source = asLegacy([1, 2, 3, 2]);
        expect(source.findLast(v => v === 2)).toBe(2);
        expect(source.findLastIndex(v => v === 2)).toBe(3);
        expect(source.findLast(v => v > 5)).toBeUndefined();
        expect(source.findLastIndex(v => v > 5)).toBe(-1);
    });

    it('toSorted는 빈 칸을 undefined로 채우고, 함수가 아닌 비교자는 거부한다', () => {
        // eslint-disable-next-line no-sparse-arrays
        const sparse = [3, , 1] as unknown as number[];
        expect(asLegacy(sparse).toSorted()).toEqual([1, 3, undefined]);
        expect(() =>
            asLegacy([1]).toSorted('x' as unknown as () => number)
        ).toThrow(TypeError);
    });

    it('findLast는 thisArg를 predicate의 this로 넘긴다', () => {
        const context = { target: 2 };
        const found = (
            [1, 2, 3] as unknown as {
                findLast(
                    p: (this: { target: number }, v: number) => boolean,
                    thisArg: { target: number }
                ): number | undefined;
            }
        ).findLast(function (v) {
            return v === this.target;
        }, context);
        expect(found).toBe(2);
    });

    it('Array·String의 at은 음수 인덱스를 뒤에서 센다', () => {
        expect(asLegacy([1, 2, 3]).at(-1)).toBe(3);
        expect(asLegacy([1, 2, 3]).at(5)).toBeUndefined();
        expect(('abc' as unknown as { at(i: number): string }).at(-1)).toBe(
            'c'
        );
    });

    it('Object.hasOwn은 자기 속성만 본다', () => {
        const hasOwn = (
            Object as unknown as {
                hasOwn(o: object, k: PropertyKey): boolean;
            }
        ).hasOwn;
        expect(hasOwn({ a: 1 }, 'a')).toBe(true);
        expect(hasOwn({ a: 1 }, 'toString')).toBe(false);
    });

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
        expect(asLegacy([1]).toSorted()).toEqual([42]);
    });
});
