/**
 * @file 수신 설정 폼(`useEmailReportSettingsForm`)의 순수 규칙 — 고를 수 있는 시각, 요일 토글,
 * 처음 보여 줄 타임존.
 */

import type {
    EmailReportSettingsView,
    Weekday,
} from '@/entities/email-report/model';

/** 고를 수 있는 발송 시각 — 0시부터 23시까지 정각. */
export const SEND_HOURS: readonly number[] = Array.from(
    { length: 24 },
    (_, hour) => hour
);

/**
 * 요일 하나를 켜거나 끈다. **마지막 남은 요일은 끄지 않는다** — 서버는 꺼진 설정에도 요일을
 * 요구하는데, 요일을 다 비운 채 스위치를 끄면 요일 칸이 비활성화돼 다시 고를 수도, 끈 상태로
 * 저장할 수도 없다. 순서는 서버가 정렬하므로 새 요일은 뒤에 붙인다.
 */
export function toggleWeekday(days: Weekday[], day: Weekday): Weekday[] {
    if (!days.includes(day)) return [...days, day];
    // 같은 배열을 돌려줘 상태 갱신이 렌더를 건너뛰게 한다.
    if (days.length === 1) return days;
    return days.filter(d => d !== day);
}

/** 브라우저 타임존. 알 수 없으면 `null`(저장된 값이나 기본값을 그대로 쓴다). */
export function detectBrowserTimeZone(): string | null {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch {
        return null;
    }
}

/**
 * 폼이 저장할 타임존. 처음 설정하는 회원은 브라우저 타임존을 쓴다 — 기본값(서울)을 강요하지
 * 않는다. 저장된 값이 있으면 그것을 유지한다. 다른 기기에서 열었다고 바꾸지 않는다.
 */
export function resolveInitialTimezone(
    initial: Pick<EmailReportSettingsView, 'isSaved' | 'timezone'>,
    browserTimeZone: string | null
): string {
    if (initial.isSaved) return initial.timezone;
    return browserTimeZone ?? initial.timezone;
}
