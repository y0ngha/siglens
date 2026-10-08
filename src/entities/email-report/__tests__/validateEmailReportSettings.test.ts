import { validateEmailReportSettings } from '@/entities/email-report/lib/validateEmailReportSettings';
import type { RawEmailReportSettingsInput } from '@/entities/email-report/model';

const VALID: RawEmailReportSettingsInput = {
    enabled: true,
    daysOfWeek: [5, 1],
    sendHour: 7,
    timezone: 'America/New_York',
};

describe('validateEmailReportSettings', () => {
    it('유효한 입력은 요일을 오름차순·중복 제거로 정규화해 통과시킨다', () => {
        expect(
            validateEmailReportSettings({ ...VALID, daysOfWeek: [5, 1, 5] })
        ).toEqual({
            ok: true,
            enabled: true,
            daysOfWeek: [1, 5],
            sendHour: 7,
            timezone: 'America/New_York',
        });
    });

    it('타임존 앞뒤 공백을 제거한다', () => {
        const result = validateEmailReportSettings({
            ...VALID,
            timezone: ' Asia/Tokyo ',
        });
        expect(result).toMatchObject({ ok: true, timezone: 'Asia/Tokyo' });
    });

    it('수신을 끈 입력도 같은 규칙으로 검증한다', () => {
        expect(
            validateEmailReportSettings({
                ...VALID,
                enabled: false,
                daysOfWeek: [],
            })
        ).toEqual({ ok: false, code: 'invalid_days' });
    });

    it.each([
        ['빈 요일', []],
        ['범위 밖 요일', [7]],
        ['음수 요일', [-1]],
        ['정수가 아닌 요일', [1.5]],
        ['8개 이상', [0, 1, 2, 3, 4, 5, 6, 0]],
    ])('%s는 invalid_days', (_, daysOfWeek) => {
        expect(validateEmailReportSettings({ ...VALID, daysOfWeek })).toEqual({
            ok: false,
            code: 'invalid_days',
        });
    });

    it.each([
        ['24시', 24],
        ['음수', -1],
        ['소수', 7.5],
        ['NaN', Number.NaN],
    ])('%s는 invalid_hour', (_, sendHour) => {
        expect(validateEmailReportSettings({ ...VALID, sendHour })).toEqual({
            ok: false,
            code: 'invalid_hour',
        });
    });

    it('경계 시각 0시와 23시는 통과한다', () => {
        expect(validateEmailReportSettings({ ...VALID, sendHour: 0 }).ok).toBe(
            true
        );
        expect(validateEmailReportSettings({ ...VALID, sendHour: 23 }).ok).toBe(
            true
        );
    });

    it.each([
        ['알 수 없는 이름', 'Mars/Olympus'],
        ['빈 문자열', '  '],
        ['64자 초과', 'A'.repeat(65)],
    ])('%s 타임존은 invalid_timezone', (_, timezone) => {
        expect(validateEmailReportSettings({ ...VALID, timezone })).toEqual({
            ok: false,
            code: 'invalid_timezone',
        });
    });

    it('Intl 목록에 없는 별칭 타임존도 통과한다', () => {
        expect(
            validateEmailReportSettings({ ...VALID, timezone: 'Asia/Calcutta' })
                .ok
        ).toBe(true);
    });
});
