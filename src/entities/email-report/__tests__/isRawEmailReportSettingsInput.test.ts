import { isRawEmailReportSettingsInput } from '@/entities/email-report/lib/isRawEmailReportSettingsInput';

const VALID = {
    enabled: true,
    daysOfWeek: [1, 3],
    sendHour: 8,
    timezone: 'Asia/Seoul',
};

describe('isRawEmailReportSettingsInput', () => {
    it('네 필드의 타입이 맞으면 통과한다', () => {
        expect(isRawEmailReportSettingsInput(VALID)).toBe(true);
    });

    it('요일 배열의 원소 타입은 보지 않는다(검증기 몫)', () => {
        expect(
            isRawEmailReportSettingsInput({ ...VALID, daysOfWeek: ['x'] })
        ).toBe(true);
    });

    it.each([
        ['null', null],
        ['문자열', 'settings'],
        ['빈 객체', {}],
        ['enabled가 문자열', { ...VALID, enabled: 'true' }],
        ['daysOfWeek가 배열이 아님', { ...VALID, daysOfWeek: 1 }],
        ['sendHour가 문자열', { ...VALID, sendHour: '8' }],
        ['timezone이 숫자', { ...VALID, timezone: 9 }],
    ])('%s는 거부한다', (_, input) => {
        expect(isRawEmailReportSettingsInput(input)).toBe(false);
    });
});
