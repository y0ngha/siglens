import {
    EMAIL_REPORT_OPT_IN_FIELD,
    EMAIL_REPORT_OPT_IN_VALUE,
    EMAIL_REPORT_TIMEZONE_FIELD,
    readSignupEmailReportOptIn,
} from '@/entities/email-report/lib/signupOptIn';

function formData(fields: Record<string, string>): FormData {
    const fd = new FormData();
    Object.entries(fields).forEach(([key, value]) => fd.set(key, value));
    return fd;
}

describe('readSignupEmailReportOptIn', () => {
    it("값이 정확히 'true'일 때만 동의로 읽는다", () => {
        expect(EMAIL_REPORT_OPT_IN_VALUE).toBe('true');
        expect(
            readSignupEmailReportOptIn(
                formData({ [EMAIL_REPORT_OPT_IN_FIELD]: 'true' })
            ).optIn
        ).toBe(true);
    });

    it.each(['on', 'false', '1', 'TRUE', ''])('%j는 동의가 아니다', value => {
        expect(
            readSignupEmailReportOptIn(
                formData({ [EMAIL_REPORT_OPT_IN_FIELD]: value })
            ).optIn
        ).toBe(false);
    });

    it('필드가 없으면 동의가 아니다', () => {
        expect(readSignupEmailReportOptIn(formData({})).optIn).toBe(false);
    });

    it('유효한 시간대는 그대로 쓴다', () => {
        expect(
            readSignupEmailReportOptIn(
                formData({ [EMAIL_REPORT_TIMEZONE_FIELD]: 'America/New_York' })
            ).timezone
        ).toBe('America/New_York');
    });

    it.each([
        ['빈 값', ''],
        ['모르는 이름', 'Mars/Base'],
        ['64자를 넘는 값', 'A'.repeat(65)],
    ])('%s은 기본 시간대(Asia/Seoul)로 바꾼다', (_label, value) => {
        expect(
            readSignupEmailReportOptIn(
                formData({ [EMAIL_REPORT_TIMEZONE_FIELD]: value })
            ).timezone
        ).toBe('Asia/Seoul');
    });

    it('시간대 필드가 없어도 기본 시간대다', () => {
        expect(readSignupEmailReportOptIn(formData({})).timezone).toBe(
            'Asia/Seoul'
        );
    });
});
