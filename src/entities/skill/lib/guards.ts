/**
 * frontmatter 파서가 만든 값(`unknown`)을 `as` 없이 좁히는 공용 타입 가드.
 * 배열도 객체로 취급한다 — 기존 파서의 `typeof === 'object'` 판정과 동일하다.
 */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

/**
 * `value`가 리터럴 튜플 `list`의 멤버인지 판정해 `T`로 좁힌다. 튜플 `.includes`는 자기 멤버 타입만
 * 받기 때문에 `readonly string[]`로 넓히는 캐스트가 필요했는데, 이 가드가 그 캐스트를 대신한다.
 */
export const isOneOf = <T extends string>(
    list: readonly T[],
    value: unknown
): value is T => list.some(item => item === value);
