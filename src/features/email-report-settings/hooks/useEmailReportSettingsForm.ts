'use client';

/**
 * @file 수신 설정 폼의 상태·저장 훅과 폼 UI가 받는 모양.
 */

import { useLocale, useTranslations } from 'next-intl';
import {
    type ChangeEvent,
    type FormEvent,
    useCallback,
    useMemo,
    useRef,
    useState,
} from 'react';
import type { useEmailReportSettings } from '@/entities/email-report/hooks/useEmailReportSettings';
import {
    EMAIL_REPORT_MAX_BRIEF_SYMBOLS,
    EMAIL_REPORT_MAX_SYMBOLS,
    WEEKDAYS_MONDAY_FIRST,
} from '@/entities/email-report/lib/emailReportConstants';
import type {
    EmailReportSettingsView,
    Weekday,
} from '@/entities/email-report/model';
import { useUrlSearchParam } from '@/shared/hooks/useUrlSearchParam';
import { INTL_LOCALE, resolveLocale } from '@/shared/i18n/locales';
import { trackFunnelEvent } from '@/shared/lib/funnel/trackFunnelEvent';
import { createScheduleLabelFormatters } from '../lib/scheduleLabels';
import {
    SEND_HOURS,
    detectBrowserTimeZone,
    resolveInitialTimezone,
    toggleWeekday,
} from '../lib/settingsForm';

/** 저장 결과 문구. 상태 영역(`role="status"`)이 읽고, `error`면 위험 색으로 보인다. */
export interface SaveStatusMessage {
    readonly tone: 'ok' | 'error';
    readonly text: string;
}

/** 요일 칩 하나 — 월요일부터 화면 순서대로 온다. */
export interface WeekdayOption {
    readonly day: Weekday;
    readonly label: string;
    readonly checked: boolean;
    /** 마지막 남은 요일이라 끌 수 없다. */
    readonly isOnlyDay: boolean;
}

/** 발송 시각 `<option>` 하나. */
export interface HourOption {
    readonly value: number;
    readonly label: string;
}

/** [[useEmailReportSettingsForm]]이 폼 UI에 넘기는 값과 안정적인 핸들러. */
export interface EmailReportSettingsFormState {
    readonly enabled: boolean;
    readonly sendHour: number;
    readonly timezone: string;
    readonly weekdayOptions: readonly WeekdayOption[];
    readonly hourOptions: readonly HourOption[];
    /** 안내 문구에 넣는 리포트 한 통의 상세·요약 종목 상한. */
    readonly symbolLimits: { readonly full: number; readonly brief: number };
    readonly message: SaveStatusMessage | null;
    readonly isSaving: boolean;
    readonly handleEnabledChange: (
        event: ChangeEvent<HTMLInputElement>
    ) => void;
    readonly handleDayToggle: (day: Weekday) => void;
    readonly handleHourChange: (event: ChangeEvent<HTMLSelectElement>) => void;
    readonly handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

/** 폼 훅이 받는 저장 뮤테이션 — `useEmailReportSettings().save`의 모양. */
export type SaveMutation = ReturnType<typeof useEmailReportSettings>['save'];

const SYMBOL_LIMITS = {
    full: EMAIL_REPORT_MAX_SYMBOLS,
    brief: EMAIL_REPORT_MAX_BRIEF_SYMBOLS,
} as const;

/**
 * 메일 리포트 수신 설정 폼의 상태와 저장 흐름(`EmailReportSettingsForm` 전용).
 *
 * 폼은 `initial`(마운트 시점 값)로 시작하고 이후 바뀌어도 따라가지 않는다. 값을 바꾸면
 * 지난 저장 문구를 지운다. 저장 중에는 다시 보내지 않는다 — 더블클릭·연타 Enter가 같은
 * 요청을 두 번 보내지 않게 한다. 꺼짐 → 켜짐으로 저장에 성공하면 `report_enabled`
 * 퍼널 이벤트를 한 번 보낸다.
 */
export function useEmailReportSettingsForm(
    initial: EmailReportSettingsView,
    { isPending: isSaving, mutateAsync }: SaveMutation
): EmailReportSettingsFormState {
    const [enabled, setEnabled] = useState(initial.enabled);
    const [days, setDays] = useState<Weekday[]>(initial.daysOfWeek);
    const [sendHour, setSendHour] = useState(initial.sendHour);
    const [timezone] = useState(() =>
        resolveInitialTimezone(initial, detectBrowserTimeZone())
    );
    const [message, setMessage] = useState<SaveStatusMessage | null>(null);
    // 꺼짐 → 켜짐 전환만 센다. 마운트 값이 아니라 마지막 저장 성공 값을 기준으로 두어, 한 세션에서
    // 두 번 저장해도 이벤트는 한 번이다.
    const wasEnabledRef = useRef(initial.enabled);

    const t = useTranslations('features.email-report-settings');
    const locale = useLocale();
    // 넛지에서 왔는지는 URL 쿼리로 안다. `useSearchParams`가 아니라 `useUrlSearchParam`을 쓰는 이유:
    // 전자는 가장 가까운 Suspense까지 CSR bailout시킨다.
    const from = useUrlSearchParam('from');

    const labels = useMemo(
        () => createScheduleLabelFormatters(INTL_LOCALE[resolveLocale(locale)]),
        [locale]
    );
    const weekdayOptions = useMemo(
        () =>
            WEEKDAYS_MONDAY_FIRST.map(day => {
                const checked = days.includes(day);
                return {
                    day,
                    label: labels.weekday(day),
                    checked,
                    isOnlyDay: checked && days.length === 1,
                };
            }),
        [days, labels]
    );
    const hourOptions = useMemo(
        () =>
            SEND_HOURS.map(hour => ({ value: hour, label: labels.hour(hour) })),
        [labels]
    );

    const handleEnabledChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setMessage(null);
            setEnabled(event.target.checked);
        },
        []
    );

    const handleDayToggle = useCallback((day: Weekday) => {
        setMessage(null);
        setDays(prev => toggleWeekday(prev, day));
    }, []);

    const handleHourChange = useCallback(
        (event: ChangeEvent<HTMLSelectElement>) => {
            setMessage(null);
            setSendHour(Number(event.target.value));
        },
        []
    );

    const handleSubmit = useCallback(
        async (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (isSaving) return;
            setMessage(null);
            try {
                const result = await mutateAsync({
                    enabled,
                    daysOfWeek: days,
                    sendHour,
                    timezone,
                });
                if (result.status !== 'ok') {
                    setMessage({ tone: 'error', text: result.message });
                    return;
                }
                if (result.settings.enabled && !wasEnabledRef.current) {
                    trackFunnelEvent('report_enabled', {
                        source: from === 'nudge' ? 'nudge' : 'settings',
                    });
                }
                wasEnabledRef.current = result.settings.enabled;
                setMessage({
                    tone: 'ok',
                    text: t('EmailReportSettingsSection.9f8a60'),
                });
            } catch {
                setMessage({
                    tone: 'error',
                    text: t('EmailReportSettingsSection.dcc8a2'),
                });
            }
        },
        [isSaving, mutateAsync, enabled, days, sendHour, timezone, from, t]
    );

    return {
        enabled,
        sendHour,
        timezone,
        weekdayOptions,
        hourOptions,
        symbolLimits: SYMBOL_LIMITS,
        message,
        isSaving,
        handleEnabledChange,
        handleDayToggle,
        handleHourChange,
        handleSubmit,
    };
}
