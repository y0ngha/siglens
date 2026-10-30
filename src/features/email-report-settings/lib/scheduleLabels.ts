/**
 * @file 수신 설정 폼의 요일·시각 라벨을 `Intl`로 만든다.
 */

import type { Weekday } from '@/entities/email-report/model';
import { MS_PER_DAY } from '@/shared/config/time';

// 2024-01-07은 일요일 — `Date#getDay()`가 n인 날짜를 만들려고 n일을 더한다.
const SUNDAY_UTC = Date.UTC(2024, 0, 7);

/** 수신 설정 폼의 요일·시각 라벨 함수. */
export interface ScheduleLabelFormatters {
    /** `Date#getDay()` 값의 짧은 요일 이름(예: ko `월`, en `Mon`). */
    readonly weekday: (day: Weekday) => string;
    /** 0~23시의 정각 시각(예: ko `오전 8:00`, en `8:00 AM`). */
    readonly hour: (hour: number) => string;
}

/**
 * 로케일의 요일·시각 라벨 함수를 만든다. 라벨은 카탈로그 대신 `Intl`로 만든다 — 네
 * 로케일의 요일 이름을 손으로 옮기면 번역 드리프트만 생긴다. 사용자의 타임존과 무관한
 * 이름표라 UTC 기준 날짜로 포맷한다.
 */
export function createScheduleLabelFormatters(
    intlLocale: string
): ScheduleLabelFormatters {
    const weekday = new Intl.DateTimeFormat(intlLocale, {
        weekday: 'short',
        timeZone: 'UTC',
    });
    const hour = new Intl.DateTimeFormat(intlLocale, {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'UTC',
    });
    return {
        weekday: day => weekday.format(new Date(SUNDAY_UTC + day * MS_PER_DAY)),
        hour: h => hour.format(new Date(Date.UTC(2024, 0, 1, h))),
    };
}
