/**
 * 지원 대상인데 일부 표준 메서드가 없는 브라우저를 위해, **없는 메서드만** 채운다.
 *
 * Next(SWC)는 문법만 내리고 내장 메서드는 폴리필하지 않는다. 그런데 클라이언트 코드는
 * `toSorted`·`toReversed`(ES2023), `findLast`·`findLastIndex`·`at`·`Object.hasOwn`(ES2022)을
 * 곳곳에서 쓴다. 운영 로그의 `[client-error] … toSorted is not a function`은 Chrome 109
 * (Windows 7/8.1에서 올릴 수 있는 마지막 Chrome)에서 났고, browserslist가 지원 대상으로 잡은
 * iOS 15.0~15.3 Safari에는 `at`·`findLast`·`Object.hasOwn`도 없다.
 *
 * 호출부를 하나씩 고치는 대신 여기서 채우는 이유: 쓰는 곳이 수십 곳이고 서버·클라이언트
 * 공용 모듈도 섞여 있어 "브라우저에 닿는 곳"을 정적으로 가려낼 수 없다. 의존 라이브러리가
 * 같은 메서드를 써도 함께 해결된다.
 *
 * `instrumentation-client.ts`가 가장 먼저 부른다 — Next는 그 파일을 하이드레이션과 라우트
 * 청크의 모듈 평가보다 먼저 실행한다(`next/dist/client/app-next.js`). 이미 있는 메서드는
 * 건드리지 않으므로 최신 브라우저에서는 아무 일도 하지 않는다. 동작은 명세와 같게 둔다
 * (`toSorted`는 비교 함수가 없으면 기본 정렬, 원본은 바꾸지 않음).
 *
 * 이 파일 자체는 위 메서드를 쓰지 않는다 — 없는 브라우저에서 돌아야 하기 때문이다.
 * 지원 하한과 폴리필 추가 절차는 TOOLCHAIN.md#TC-36.
 */

type Comparator = (a: unknown, b: unknown) => number;
type Predicate = (value: unknown, index: number, array: unknown[]) => unknown;

function defineMissing(target: object, name: string, value: unknown): void {
    if (name in target) return;
    Object.defineProperty(target, name, {
        value,
        writable: true,
        configurable: true,
        enumerable: false,
    });
}

/** 명세처럼 콜백이 함수가 아니면 바로 던진다(최신 브라우저와 같은 실패 지점). */
function requireCallable(fn: unknown, method: string): void {
    if (typeof fn !== 'function') {
        throw new TypeError(`${method}: predicate must be a function`);
    }
}

/** `at`의 정수 변환 — 음수는 뒤에서 센다. 범위 밖이면 `undefined`. */
function relativeIndex(length: number, index: number): number | null {
    const n = Math.trunc(index) || 0;
    const k = n >= 0 ? n : length + n;
    return k < 0 || k >= length ? null : k;
}

export function installLegacyBrowserPolyfills(): void {
    const arrayProto = Array.prototype as unknown as Record<string, unknown>;

    defineMissing(
        arrayProto,
        'toSorted',
        function toSorted(this: unknown[], compare?: Comparator) {
            if (compare !== undefined && typeof compare !== 'function') {
                throw new TypeError('toSorted: comparator must be a function');
            }
            // `Array.from`은 명세처럼 빈 칸(hole)을 `undefined`로 채운 사본을 만든다.
            return Array.from(this).sort(compare);
        }
    );
    defineMissing(
        arrayProto,
        'toReversed',
        function toReversed(this: unknown[]) {
            return Array.from(this).reverse();
        }
    );
    defineMissing(
        arrayProto,
        'findLastIndex',
        function findLastIndex(
            this: unknown[],
            predicate: Predicate,
            thisArg?: unknown
        ) {
            requireCallable(predicate, 'findLastIndex');
            for (let i = this.length - 1; i >= 0; i -= 1) {
                if (predicate.call(thisArg, this[i], i, this)) return i;
            }
            return -1;
        }
    );
    defineMissing(
        arrayProto,
        'findLast',
        function findLast(
            this: unknown[],
            predicate: Predicate,
            thisArg?: unknown
        ) {
            requireCallable(predicate, 'findLast');
            for (let i = this.length - 1; i >= 0; i -= 1) {
                if (predicate.call(thisArg, this[i], i, this)) return this[i];
            }
            return undefined;
        }
    );
    defineMissing(
        arrayProto,
        'at',
        function at(this: unknown[], index: number) {
            const k = relativeIndex(this.length, index);
            return k === null ? undefined : this[k];
        }
    );
    defineMissing(
        String.prototype,
        'at',
        function at(this: string, index: number) {
            const s = String(this);
            const k = relativeIndex(s.length, index);
            return k === null ? undefined : s.charAt(k);
        }
    );
    defineMissing(
        Object,
        'hasOwn',
        function hasOwn(object: object, key: PropertyKey) {
            return Object.prototype.hasOwnProperty.call(object, key);
        }
    );
}
