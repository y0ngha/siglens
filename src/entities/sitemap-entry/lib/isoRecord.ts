/**
 * `Date` 값 레코드를 ISO 문자열 레코드로 바꾼다. `unstable_cache`가 반환값을 JSON으로
 * 직렬화하므로 캐시 콜백은 `Date`를 그대로 내보내지 않고 이 형태로 넘긴다.
 * 값이 `undefined`면 던진다 — 조용히 건너뛰면 캐시에 빠진 키가 굳는다.
 */
export function toIsoRecord(
    record: Partial<Record<string, Date>>
): Record<string, string> {
    return Object.fromEntries(
        Object.entries<Date | undefined>(record).map(([key, value]) => {
            if (value === undefined) {
                throw new TypeError(`toIsoRecord: "${key}" 값이 undefined다`);
            }
            return [key, value.toISOString()];
        })
    );
}

/**
 * {@link toIsoRecord}가 만든 레코드를 캐시 경계 너머에서 `Date`로 복원한다. 복원하지
 * 않으면 빌더가 문자열에 `.getTime()`을 불러 죽는다. 값이 없으면(`undefined`, 타입 밖의
 * `null` 포함) `Invalid Date`가 된다 — epoch로 바꿔 틀린 lastmod를 내보내지 않는다.
 */
export function fromIsoRecord(
    record: Partial<Record<string, string>>
): Record<string, Date> {
    return Object.fromEntries(
        Object.entries<string | undefined>(record).map(([key, value]) => [
            key,
            new Date(value ?? NaN),
        ])
    );
}
