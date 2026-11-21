'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import {
    DEFAULT_EMAIL_REPORT_DAYS,
    DEFAULT_EMAIL_REPORT_HOUR,
} from '@/entities/email-report/lib/emailReportConstants';
import {
    EMAIL_REPORT_OPT_IN_FIELD,
    EMAIL_REPORT_OPT_IN_VALUE,
    EMAIL_REPORT_OPT_OUT_VALUE,
    EMAIL_REPORT_TIMEZONE_FIELD,
} from '@/entities/email-report/lib/signupOptIn';
import { INTL_LOCALE, resolveLocale } from '@/shared/i18n/locales';
import { OptionalConsentCheckbox } from '@/shared/ui/auth/OptionalConsentCheckbox';
import { createScheduleLabelFormatters } from '../lib/scheduleLabels';
import { detectBrowserTimeZone } from '../lib/settingsForm';

interface EmailReportSignupOptInProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
}

/**
 * 가입 화면(이메일 3단계, 소셜 동의 화면)의 선택 항목: 메일 리포트 받기. 기본은 꺼져 있고
 * 필수 약관 묶음의 "모두 동의"와 무관하다. 체크하는 순간(이벤트 핸들러) 브라우저 시간대를 읽어
 * 숨은 입력으로 함께 보낸다 — 렌더 중에 읽으면 서버·클라이언트 HTML이 어긋나고, 체크하지 않았으면
 * 읽을 이유도 없다. 서버는 값을 다시 검증하고 틀리면 기본 시간대를 쓴다.
 */
export function EmailReportSignupOptIn({
    checked,
    onChange,
}: EmailReportSignupOptInProps) {
    const t = useTranslations(
        'features.email-report-settings.EmailReportSignupOptIn'
    );
    const locale = resolveLocale(useLocale());
    const [timezone, setTimezone] = useState('');

    const schedule = useMemo(() => {
        const formatters = createScheduleLabelFormatters(INTL_LOCALE[locale]);
        const [firstDay] = DEFAULT_EMAIL_REPORT_DAYS;
        return {
            // zh는 문장 안에서 `每周一`(짧은 요일)이 자연스럽다. `星期一`을 붙이면 `每星期一`이 된다.
            weekday:
                locale === 'zh'
                    ? formatters.weekday(firstDay)
                    : formatters.weekdayLong(firstDay),
            time: formatters.hourOnly(DEFAULT_EMAIL_REPORT_HOUR),
        };
    }, [locale]);

    function handleChange(next: boolean): void {
        if (next) setTimezone(detectBrowserTimeZone() ?? '');
        onChange(next);
    }

    return (
        <>
            <input
                type="hidden"
                name={EMAIL_REPORT_OPT_IN_FIELD}
                value={
                    checked
                        ? EMAIL_REPORT_OPT_IN_VALUE
                        : EMAIL_REPORT_OPT_OUT_VALUE
                }
            />
            <input
                type="hidden"
                name={EMAIL_REPORT_TIMEZONE_FIELD}
                value={timezone}
            />
            <OptionalConsentCheckbox
                legend={t('legend')}
                label={t('label')}
                description={t('description', schedule)}
                checked={checked}
                onChange={handleChange}
            />
        </>
    );
}
