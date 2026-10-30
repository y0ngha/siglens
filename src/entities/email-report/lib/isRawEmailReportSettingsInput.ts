import type { RawEmailReportSettingsInput } from '../model';

/**
 * Server Action 인자는 선언 타입과 무관하게 클라이언트가 임의 JSON을 보낼 수 있다.
 * `validateEmailReportSettings`가 필드 타입을 가정하므로 그 앞에서 모양부터 좁힌다.
 * 요일 배열의 원소 타입과 값 범위는 검증기가 본다.
 */
export function isRawEmailReportSettingsInput(
    input: unknown
): input is RawEmailReportSettingsInput {
    return (
        typeof input === 'object' &&
        input !== null &&
        'enabled' in input &&
        typeof input.enabled === 'boolean' &&
        'daysOfWeek' in input &&
        Array.isArray(input.daysOfWeek) &&
        'sendHour' in input &&
        typeof input.sendHour === 'number' &&
        'timezone' in input &&
        typeof input.timezone === 'string'
    );
}
