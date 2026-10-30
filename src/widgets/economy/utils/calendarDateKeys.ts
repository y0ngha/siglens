/**
 * KST 날짜 키('YYYY-MM-DD') 산술 — 시스템 타임존과 무관하게 UTC 기준으로 계산한다.
 */

/** `parseDateKey` 반환 타입. */
export interface ParsedDateKey {
    year: number;
    /** 0-indexed (0=1월) */
    month: number;
    day: number;
}

/**
 * 'YYYY-MM-DD'에서 {year, month(0-idx), day}를 파싱한다.
 * `new Date(key)`는 로컬 자정 기준이라 시스템 TZ에 의존하므로 직접 파싱한다.
 */
export function parseDateKey(key: string): ParsedDateKey {
    const [y, m, d] = key.split('-').map(Number);
    return { year: y, month: m - 1, day: d };
}

/** 'YYYY-MM-DD' 기준 요일(0=일). */
export function dayOfWeekFromKey(key: string): number {
    const { year, month, day } = parseDateKey(key);
    return new Date(Date.UTC(year, month, day)).getUTCDay();
}

/** 해당 월의 마지막 일자. */
export function daysInMonth(year: number, month: number): number {
    return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** 연·월(0-idx)·일을 'YYYY-MM-DD'로 만든다. */
export function toDateKey(year: number, month: number, day: number): string {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
