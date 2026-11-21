/**
 * 테스트에서 `x!` 대신 쓰는 좁히기 헬퍼.
 *
 * `x!`는 타입 검사만 끄고 값이 비어 있으면 한참 뒤에 의미 없는 `TypeError`로 터진다.
 * 이 헬퍼는 비어 있는 그 자리에서 무엇이 비었는지 밝히며 던진다. `0`, `''`, `false`는
 * 값이므로 그대로 돌려준다(`null`과 `undefined`만 비어 있는 것으로 본다).
 */
export function defined<T>(value: T | null | undefined, what = 'value'): T {
    if (value === null || value === undefined) {
        throw new Error(`expected ${what} to be defined`);
    }
    return value;
}
