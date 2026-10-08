import type {
    RawEmailReportSettingsInput,
    ValidateEmailReportSettingsResult,
    Weekday,
} from '../model';

function isWeekday(value: unknown): value is Weekday {
    return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 6;
}

/**
 * IANA 타임존 이름인지. `Intl.DateTimeFormat`이 모르는 이름이면 RangeError를 던진다.
 * `Intl.supportedValuesOf('timeZone')`은 별칭(`Asia/Calcutta` 등)을 빠뜨려 브라우저가
 * 돌려준 정상 값을 거부하므로 쓰지 않는다.
 */
function isValidTimeZone(timezone: string): boolean {
    if (timezone.length === 0 || timezone.length > 64) return false;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: timezone });
        return true;
    } catch {
        return false;
    }
}

/**
 * 수신 설정 입력을 검증한다. 요일은 중복 제거·오름차순으로 정규화한다.
 *
 * 수신을 끈 저장에도 요일·시각을 검증한다 — 끈 상태로 저장한 값이 다음에 켤 때
 * 그대로 쓰이므로, 꺼져 있다고 깨진 값을 받아 두면 켜는 순간 발송 매칭이 어긋난다.
 */
export function validateEmailReportSettings(
    input: RawEmailReportSettingsInput
): ValidateEmailReportSettingsResult {
    if (
        input.daysOfWeek.length === 0 ||
        input.daysOfWeek.length > 7 ||
        !input.daysOfWeek.every(isWeekday)
    ) {
        return { ok: false, code: 'invalid_days' };
    }
    if (
        !Number.isInteger(input.sendHour) ||
        input.sendHour < 0 ||
        input.sendHour > 23
    ) {
        return { ok: false, code: 'invalid_hour' };
    }
    const timezone = input.timezone.trim();
    if (!isValidTimeZone(timezone)) {
        return { ok: false, code: 'invalid_timezone' };
    }
    const daysOfWeek = [...new Set(input.daysOfWeek)].toSorted((a, b) => a - b);
    return {
        ok: true,
        enabled: input.enabled,
        daysOfWeek,
        sendHour: input.sendHour,
        timezone,
    };
}
