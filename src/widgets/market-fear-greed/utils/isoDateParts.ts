/**
 * ISO `YYYY-MM-DD` 달력 날짜를 메시지 인자로 쓸 연·월·일 숫자로 나눈다.
 */

/** 달력 날짜의 연·월(1–12)·일(1–31). */
export interface IsoDateParts {
    readonly year: number;
    readonly month: number;
    readonly day: number;
}

/**
 * `YYYY-MM-DD` 각 필드의 문자 범위. `split('-')`의 배열 인덱싱은 원소가 없을 수
 * 있다는 타입을 돌려줘 단언이 필요해지므로, 고정 폭 포맷을 위치로 잘라 읽는다.
 */
const FIELD_RANGE = {
    year: [0, 4],
    month: [5, 7],
    day: [8, 10],
} as const satisfies Record<keyof IsoDateParts, readonly [number, number]>;

/**
 * `asOf` 같은 ISO 달력 날짜를 연·월·일로 나눈다.
 *
 * `Date`를 거치지 않는다 — `new Date('2026-08-14')`는 UTC 자정이라 서버
 * 타임존에 따라 지역 날짜로 읽으면 하루 앞당겨질 수 있다. 문자열에 적힌
 * 세션 날짜를 그대로 보여 주는 것이 목적이다.
 */
export function isoDateParts(isoDate: string): IsoDateParts {
    const read = ([start, end]: readonly [number, number]): number =>
        Number(isoDate.slice(start, end));
    return {
        year: read(FIELD_RANGE.year),
        month: read(FIELD_RANGE.month),
        day: read(FIELD_RANGE.day),
    };
}
