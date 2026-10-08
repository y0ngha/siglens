import type { Weekday } from '../model';

const ALL_WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];

/** 요일 목록 → 비트마스크(bit n = 요일 n). 중복은 한 번만 센다. */
export function weekdaysToMask(days: readonly Weekday[]): number {
    return days.reduce<number>((mask, day) => mask | (1 << day), 0);
}

/** 비트마스크 → 오름차순 요일 목록. 0–6 밖의 비트는 무시한다. */
export function maskToWeekdays(mask: number): Weekday[] {
    return ALL_WEEKDAYS.filter(day => (mask & (1 << day)) !== 0);
}
