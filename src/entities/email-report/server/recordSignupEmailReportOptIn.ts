import 'server-only';
import type { EmailReportConsentSource } from '@/shared/db/constants';
import type { SiglensDatabase } from '@/shared/db/types';
import type { Locale } from '@/shared/i18n/locales';
import { logActionError } from '@/shared/lib/logActionError';
import { DrizzleEmailReportSubscriptionRepository } from '../api';
import {
    DEFAULT_EMAIL_REPORT_DAYS,
    DEFAULT_EMAIL_REPORT_HOUR,
} from '../lib/emailReportConstants';
import { weekdaysToMask } from '../lib/weekdayMask';

export interface SignupEmailReportOptInInput {
    userId: string;
    /** 이미 검증된 IANA 시간대(`readSignupEmailReportOptIn`). */
    timezone: string;
    /** 메일 언어 — 가입한 화면의 언어. */
    locale: Locale;
    source: Extract<EmailReportConsentSource, 'signup_email' | 'signup_oauth'>;
}

/**
 * 가입 화면에서 고른 메일 리포트 수신을 기본 일정(월요일 오전, 브라우저 시간대)으로 저장한다.
 * 던지지 않는다: 실패는 기록만 하고 `false`. 선택 사항이라 가입 자체를 막지 않는다 —
 * 회원은 메일 리포트 설정에서 직접 켤 수 있다.
 */
export async function recordSignupEmailReportOptIn(
    db: SiglensDatabase,
    input: SignupEmailReportOptInInput
): Promise<boolean> {
    try {
        await new DrizzleEmailReportSubscriptionRepository(db).upsert({
            userId: input.userId,
            enabled: true,
            daysOfWeek: weekdaysToMask(DEFAULT_EMAIL_REPORT_DAYS),
            sendHour: DEFAULT_EMAIL_REPORT_HOUR,
            timezone: input.timezone,
            locale: input.locale,
            consentSource: input.source,
        });
        return true;
    } catch (error) {
        logActionError('[recordSignupEmailReportOptIn] upsert failed', error);
        return false;
    }
}
