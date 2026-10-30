import { compareIsoDate } from '../investorFlowsDates';

/** 숫자 또는 숫자 문자열(FMP가 섞어 준다)을 유한수로 읽는다. 빈 문자열·NaN·Infinity는 `null`. */
export function finiteNumber(value: unknown): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

/** `finiteNumber`이되 음수는 `null`로 버린다(0은 유효). */
export function nonNegative(value: unknown): number | null {
    const n = finiteNumber(value);
    return n !== null && n >= 0 ? n : null;
}

/** FMP 날짜 필드가 `yyyy-mm-dd`로 시작하는 문자열인가(시각이 붙어 와도 통과) — 호출부가 `slice(0, 10)`으로 날짜만 취한다. */
export function isIsoDate(value: unknown): value is string {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value);
}

/** `key`(ISO 날짜·기간 문자열) 기준 오름차순으로 정렬해 최신 `max`개만 남긴다. 입력 배열은 바꾸지 않는다. */
export function ascendingTail<T>(
    rows: readonly T[],
    key: (row: T) => string,
    max: number
): T[] {
    return [...rows].sort((a, b) => compareIsoDate(key(a), key(b))).slice(-max);
}
