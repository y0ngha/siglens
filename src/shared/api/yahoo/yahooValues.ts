/**
 * Yahoo 응답 필드를 좁히는 공용 헬퍼. 라이브러리 타입이 느슨하고(`validateResult: false`) Redis가
 * JSON을 거치므로, 캐시에 넣는 DTO는 이 헬퍼로 좁힌 값만 담는다. 숫자는 `toFiniteNumber`를 쓴다.
 */

/** 비어 있지 않은 문자열만 통과시킨다. */
export function nonEmptyStringOrNull(value: unknown): string | null {
    return typeof value === 'string' && value !== '' ? value : null;
}

/** 문자열(빈 문자열 포함)만 통과시킨다 — 등급 문구처럼 빈 값 자체가 의미 있는 필드용. */
export function stringOrNull(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}

/** Yahoo의 소수 비율(0.7117)을 퍼센트(71.17)로, 소수 둘째 자리까지. 숫자가 아니면 `null`. */
export function fractionToPct(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value)
        ? Math.round(value * 10_000) / 100
        : null;
}

/**
 * `Date`·ISO 문자열·epoch 초를 ISO 문자열로 바꾼다(Redis JSON 왕복용). 해석이 안 되면 `null`.
 */
export function toIsoOrNull(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const date =
        value instanceof Date
            ? value
            : new Date(
                  typeof value === 'number' ? value * 1000 : String(value)
              );
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
