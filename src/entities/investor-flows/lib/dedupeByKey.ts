/** 중복 제거 결과 — 남긴 행과, 버린 행 수·버린 키 예시(로그용). */
export interface DedupeByKeyResult<T> {
    rows: T[];
    /** 같은 키의 앞 행이 뒤 행에 밀려 버려진 수. */
    dropped: number;
    /** 중복이 난 키(처음 나온 순서, 최대 `DEDUPE_EXAMPLE_LIMIT`개). */
    exampleKeys: string[];
}

/** 로그에 싣는 중복 키 예시 상한 — 수백 건이 겹쳐도 한 줄로 남기려는 것이다. */
export const DEDUPE_EXAMPLE_LIMIT = 5;

/** `compositeKey`의 구분자 — 값 안에 나오지 않는 NUL. */
export const COMPOSITE_KEY_SEPARATOR = '\u0000';

/** 여러 열로 된 충돌 대상 키를 한 문자열로. */
export const compositeKey = (...parts: readonly (string | number)[]): string =>
    parts.join(COMPOSITE_KEY_SEPARATOR);

/**
 * 한 번의 upsert에 넣을 행에서 충돌 대상(`ON CONFLICT` target) 키가 같은 행을 하나로 줄인다 — Postgres는 한 문장의
 * `ON CONFLICT DO UPDATE`가 같은 행을 두 번 건드리면 21000(`cannot affect row a second time`)으로 문장 전체를 거부한다.
 *
 * **뒤의 행이 이긴다**(자리는 그 키가 처음 나온 곳). `exampleKeys`도 키가 **처음 나온 순서**다(`A, B, B, A` → `[A, B]`). 같은 행들을 한 줄씩 차례로 upsert했을 때 남는 값과 같아서, 청크 경계를
 * 넘어 겹치던 기존 동작(뒤 청크가 앞 청크를 덮음)도 그대로다. 청크로 자르기 **전에** 전체 입력에 적용한다.
 */
export function dedupeByKey<T>(
    rows: readonly T[],
    keyOf: (row: T) => string
): DedupeByKeyResult<T> {
    // `Map.groupBy`는 키가 처음 나온 순서를 지킨다 — 남길 행의 자리와 예시 키의 순서가 모두 그 순서다.
    const groups = [...Map.groupBy(rows, keyOf)];
    return {
        rows: groups.map(([, group]) => group[group.length - 1] as T),
        dropped: rows.length - groups.length,
        exampleKeys: groups
            .filter(([, group]) => group.length > 1)
            .slice(0, DEDUPE_EXAMPLE_LIMIT)
            .map(([key]) => key),
    };
}
