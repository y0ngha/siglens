/**
 * `value`가 리터럴 튜플 `list`의 멤버인지 판정해 `T`로 좁힌다. 튜플 `.includes`는 자기 멤버 타입만
 * 받기 때문에 `readonly string[]`로 넓히는 캐스트가 필요했는데, 이 가드가 그 캐스트를 대신한다.
 */
export const isOneOf = <T extends string>(
    list: readonly T[],
    value: unknown
): value is T => list.some(item => item === value);
