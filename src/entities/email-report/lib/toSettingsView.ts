import type { EmailReportSubscriptionRecord } from '@/shared/db/types';
import type { EmailReportSettingsView } from '../model';
import {
    DEFAULT_EMAIL_REPORT_DAYS,
    DEFAULT_EMAIL_REPORT_HOUR,
    DEFAULT_EMAIL_REPORT_TIMEZONE,
} from './emailReportConstants';
import { maskToWeekdays } from './weekdayMask';

/** 저장된 행 → 화면 값. 행이 없으면 기본값(수신 꺼짐)을 돌려준다. */
export function toSettingsView(
    record: EmailReportSubscriptionRecord | null
): EmailReportSettingsView {
    if (record === null) {
        return {
            enabled: false,
            daysOfWeek: [...DEFAULT_EMAIL_REPORT_DAYS],
            sendHour: DEFAULT_EMAIL_REPORT_HOUR,
            timezone: DEFAULT_EMAIL_REPORT_TIMEZONE,
            isSaved: false,
        };
    }
    return {
        enabled: record.enabled,
        daysOfWeek: maskToWeekdays(record.daysOfWeek),
        sendHour: record.sendHour,
        timezone: record.timezone,
        isSaved: true,
    };
}
