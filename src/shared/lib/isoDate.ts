import { ISO_DATE_LENGTH } from '@/shared/config/time';

/**
 * 순간 `date`의 **UTC** 달력 날짜 `YYYY-MM-DD`.
 *
 * UTC 자정을 날짜 경계로 쓴다. 거래소·사용자 현지(ET·KST) 달력 날짜가 필요하면
 * `zonedDate`(`marketSessionDate`)나 `kstDateKey`(`etTimeUtils`)를 쓸 것 — 미국 장
 * 마감 후나 한국 오전 시각에는 UTC 날짜와 현지 날짜가 하루 어긋난다.
 */
export function toUtcIsoDate(date: Date): string {
    return date.toISOString().slice(0, ISO_DATE_LENGTH);
}

/** `YYYY-MM-DD`에 `days`일을 더한 `YYYY-MM-DD` — UTC 산술이라 서버 타임존과 무관하다. */
export function addUtcIsoDays(isoDate: string, days: number): string {
    const [y, m, d] = isoDate.split('-').map(Number);
    return toUtcIsoDate(new Date(Date.UTC(y, m - 1, d + days)));
}
