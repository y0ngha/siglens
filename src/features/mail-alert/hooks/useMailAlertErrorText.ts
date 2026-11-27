'use client';

import { useTranslations } from 'next-intl';
import { MAIL_ALERT_MAX_TOPICS } from '@/entities/mail-alert/lib/mailAlertConstants';

/** 화면에 문구로 풀어 주는 서버 결과 코드. 성공(`subscribed`·`code_sent`·`ok`)과 `idle`은 문구가 없다. */
export type MailAlertErrorStatus =
    | 'wrong_code'
    | 'expired'
    | 'too_many'
    | 'rate_limited'
    | 'limit_reached'
    | 'unavailable'
    | 'invalid_email'
    | 'invalid'
    | 'needs_code'
    | 'not_found';

/** 결과 코드 → 사용자에게 보이는 한 문장. 키는 리터럴 호출이라 추출기가 본다(I18-16). */
export function useMailAlertErrorText(): (
    status: MailAlertErrorStatus
) => string {
    const t = useTranslations('features.mail-alert');
    const text: Record<MailAlertErrorStatus, string> = {
        wrong_code: t('errWrongCode'),
        expired: t('errExpired'),
        too_many: t('errTooMany'),
        rate_limited: t('errRateLimited'),
        limit_reached: t('errLimit', { max: MAIL_ALERT_MAX_TOPICS }),
        unavailable: t('errUnavailable'),
        invalid_email: t('errInvalidEmail'),
        invalid: t('errInvalid'),
        // 코드 없이 더하려 했지만 이 브라우저의 신청 기록이 사라졌다 — 새로 고치면 처음 화면이 나온다.
        needs_code: t('errInvalid'),
        not_found: t('errInvalid'),
    };
    return status => text[status];
}
