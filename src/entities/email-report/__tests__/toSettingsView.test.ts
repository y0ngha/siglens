import {
    DEFAULT_EMAIL_REPORT_DAYS,
    DEFAULT_EMAIL_REPORT_HOUR,
    DEFAULT_EMAIL_REPORT_TIMEZONE,
} from '@/entities/email-report/lib/emailReportConstants';
import { toSettingsView } from '@/entities/email-report/lib/toSettingsView';
import type { EmailReportSubscriptionRecord } from '@/shared/db/types';

describe('toSettingsView', () => {
    it('행이 없으면 수신 꺼짐 기본값이고 isSaved는 false다', () => {
        expect(toSettingsView(null)).toEqual({
            enabled: false,
            daysOfWeek: [...DEFAULT_EMAIL_REPORT_DAYS],
            sendHour: DEFAULT_EMAIL_REPORT_HOUR,
            timezone: DEFAULT_EMAIL_REPORT_TIMEZONE,
            isSaved: false,
        });
    });

    it('저장된 행은 비트마스크를 요일 목록으로 풀어 돌려준다', () => {
        const record: EmailReportSubscriptionRecord = {
            userId: 'user-1',
            enabled: true,
            daysOfWeek: 0b0100010,
            sendHour: 21,
            timezone: 'Europe/London',
            locale: 'en',
            consentedAt: new Date('2026-10-01T00:00:00.000Z'),
            createdAt: new Date('2026-10-01T00:00:00.000Z'),
            updatedAt: new Date('2026-10-02T00:00:00.000Z'),
        };
        expect(toSettingsView(record)).toEqual({
            enabled: true,
            daysOfWeek: [1, 5],
            sendHour: 21,
            timezone: 'Europe/London',
            isSaved: true,
        });
    });
});
