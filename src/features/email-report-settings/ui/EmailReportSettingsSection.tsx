'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useId, useMemo, useState } from 'react';
import { useEmailReportSettings } from '@/entities/email-report/hooks/useEmailReportSettings';
import {
    EMAIL_REPORT_MAX_SYMBOLS,
    WEEKDAYS_MONDAY_FIRST,
} from '@/entities/email-report/lib/emailReportConstants';
import type {
    EmailReportSettingsView,
    Weekday,
} from '@/entities/email-report/model';
import { INTL_LOCALE, resolveLocale } from '@/shared/i18n/locales';
import { BUTTON_OUTLINE, BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';

const SAVE_BUTTON = cn(BUTTON_PRIMARY, 'h-10 px-4 text-sm');
const RETRY_BUTTON = cn(BUTTON_OUTLINE, 'h-9 px-3 text-sm');
const FIELD_LABEL = 'mb-2 block text-xs font-medium text-secondary-400';
const HOUR_SELECT =
    'h-10 w-full touch-manipulation rounded-lg border border-border-control bg-secondary-950 px-3 text-sm text-secondary-100 tabular-nums transition-colors outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/40 sm:w-40';
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
// 2024-01-07은 일요일 — `Date#getDay()`가 n인 날짜를 만들려고 n일을 더한다.
const SUNDAY_UTC = Date.UTC(2024, 0, 7);

/** 브라우저 타임존. 알 수 없으면 `null`(저장된 값이나 기본값을 그대로 쓴다). */
function detectBrowserTimeZone(): string | null {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch {
        return null;
    }
}

/**
 * 요일·시각 라벨은 카탈로그 대신 `Intl`로 만든다 — 네 로케일의 요일 이름을 손으로
 * 옮기면 번역 드리프트만 생긴다.
 */
function useIntlLabels() {
    const intlLocale = INTL_LOCALE[resolveLocale(useLocale())];
    return useMemo(() => {
        const weekday = new Intl.DateTimeFormat(intlLocale, {
            weekday: 'short',
            timeZone: 'UTC',
        });
        const hour = new Intl.DateTimeFormat(intlLocale, {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: 'UTC',
        });
        return {
            weekday: (day: Weekday) =>
                weekday.format(new Date(SUNDAY_UTC + day * 86_400_000)),
            hour: (h: number) => hour.format(new Date(Date.UTC(2024, 0, 1, h))),
        };
    }, [intlLocale]);
}

interface SettingsFormProps {
    initial: EmailReportSettingsView;
    save: ReturnType<typeof useEmailReportSettings>['save'];
}

function SettingsForm({ initial, save }: SettingsFormProps) {
    const t = useTranslations('features.email-report-settings');
    const labels = useIntlLabels();
    const toggleId = useId();
    const hourId = useId();
    const statusId = useId();
    const daysHintId = useId();

    const [enabled, setEnabled] = useState(initial.enabled);
    const [days, setDays] = useState<Weekday[]>(initial.daysOfWeek);
    const [sendHour, setSendHour] = useState(initial.sendHour);
    // 처음 설정하는 회원은 브라우저 타임존을 쓴다 — 기본값(서울)을 강요하지 않는다.
    // 저장된 값이 있으면 그것을 유지한다. 다른 기기에서 열었다고 바꾸지 않는다.
    const [timezone] = useState(() =>
        initial.isSaved
            ? initial.timezone
            : (detectBrowserTimeZone() ?? initial.timezone)
    );
    const [message, setMessage] = useState<{
        tone: 'ok' | 'error';
        text: string;
    } | null>(null);

    // 마지막 남은 요일은 해제할 수 없다. 서버는 꺼진 설정에도 요일을 요구하는데, 요일을 다
    // 비운 채 스위치를 끄면 요일 칸이 비활성화돼 다시 고를 수도, 끈 상태로 저장할 수도 없었다.
    const toggleDay = (day: Weekday) => {
        setMessage(null);
        setDays(prev =>
            prev.includes(day)
                ? prev.length > 1
                    ? prev.filter(d => d !== day)
                    : prev
                : [...prev, day]
        );
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setMessage(null);
        try {
            const result = await save.mutateAsync({
                enabled,
                daysOfWeek: days,
                sendHour,
                timezone,
            });
            setMessage(
                result.status === 'ok'
                    ? {
                          tone: 'ok',
                          text: t('EmailReportSettingsSection.9f8a60'),
                      }
                    : { tone: 'error', text: result.message }
            );
        } catch {
            setMessage({
                tone: 'error',
                text: t('EmailReportSettingsSection.dcc8a2'),
            });
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="flex items-start justify-between gap-4 rounded-lg bg-secondary-900/60 p-4 ring-1 ring-secondary-700">
                <div>
                    <label
                        htmlFor={toggleId}
                        className="text-sm font-semibold text-secondary-100"
                    >
                        {t('EmailReportSettingsSection.633367')}
                    </label>
                    <p className="mt-1 text-sm text-secondary-400">
                        {t('EmailReportSettingsSection.313286', {
                            v0: EMAIL_REPORT_MAX_SYMBOLS,
                        })}
                    </p>
                </div>
                <input
                    id={toggleId}
                    type="checkbox"
                    role="switch"
                    checked={enabled}
                    aria-checked={enabled}
                    onChange={event => {
                        setMessage(null);
                        setEnabled(event.target.checked);
                    }}
                    className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-primary-600"
                />
            </div>

            <div className={cn('space-y-5', !enabled && 'opacity-60')}>
                <fieldset disabled={!enabled} aria-describedby={daysHintId}>
                    <legend className={FIELD_LABEL}>
                        {t('EmailReportSettingsSection.b081bb')}
                    </legend>
                    <div className="flex flex-wrap gap-2">
                        {WEEKDAYS_MONDAY_FIRST.map(day => {
                            const checked = days.includes(day);
                            const isOnlyDay = checked && days.length === 1;
                            return (
                                <label
                                    key={day}
                                    className={cn(
                                        'inline-flex h-10 min-w-11 cursor-pointer items-center justify-center rounded-lg border px-3 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-500',
                                        checked
                                            ? 'border-primary-500 bg-primary-600/15 font-semibold text-secondary-50'
                                            : 'border-border-control text-secondary-300 hover:bg-secondary-800'
                                    )}
                                >
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={checked}
                                        disabled={isOnlyDay}
                                        onChange={() => toggleDay(day)}
                                    />
                                    {labels.weekday(day)}
                                </label>
                            );
                        })}
                    </div>
                    <p
                        id={daysHintId}
                        className="mt-2 text-xs text-secondary-400"
                    >
                        {t('EmailReportSettingsSection.f1ce16')}
                    </p>
                </fieldset>

                <div>
                    <label htmlFor={hourId} className={FIELD_LABEL}>
                        {t('EmailReportSettingsSection.f0cf28')}
                    </label>
                    <select
                        id={hourId}
                        value={sendHour}
                        disabled={!enabled}
                        onChange={event => {
                            setMessage(null);
                            setSendHour(Number(event.target.value));
                        }}
                        className={HOUR_SELECT}
                    >
                        {HOURS.map(hour => (
                            <option key={hour} value={hour}>
                                {labels.hour(hour)}
                            </option>
                        ))}
                    </select>
                    <p className="mt-2 text-xs text-secondary-400">
                        {t('EmailReportSettingsSection.a4c309', {
                            v0: timezone,
                        })}
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <button
                    type="submit"
                    className={SAVE_BUTTON}
                    disabled={save.isPending}
                    aria-describedby={statusId}
                >
                    {save.isPending
                        ? t('EmailReportSettingsSection.9f6785')
                        : t('EmailReportSettingsSection.1f1712')}
                </button>
                <p
                    id={statusId}
                    role="status"
                    aria-live="polite"
                    className={cn(
                        'min-h-5 text-sm',
                        message?.tone === 'error'
                            ? 'text-ui-danger-text'
                            : 'text-secondary-300'
                    )}
                >
                    {message?.text}
                </p>
            </div>
        </form>
    );
}

function SettingsSkeleton() {
    const t = useTranslations('features.email-report-settings');
    return (
        <div role="status" aria-busy="true" aria-live="polite">
            <span className="sr-only">
                {t('EmailReportSettingsSection.e61b39')}
            </span>
            <div className="space-y-3" aria-hidden="true">
                <div className="h-16 animate-pulse rounded-lg bg-secondary-700" />
                <div className="h-10 w-2/3 animate-pulse rounded-lg bg-secondary-700" />
            </div>
        </div>
    );
}

/**
 * 정기 메일 리포트 수신 설정 폼. `/email-report` 페이지가 쓴다 — 제목과 안내는 페이지
 * 헤더가 맡는다.
 */
export function EmailReportSettingsSection() {
    const t = useTranslations('features.email-report-settings');
    const { settings, isPending, isError, refetch, save } =
        useEmailReportSettings();

    return (
        <div className="space-y-4">
            {isPending ? (
                <SettingsSkeleton />
            ) : isError || !settings ? (
                <div className="flex flex-wrap items-center gap-3 text-sm text-secondary-300">
                    <p role="alert">{t('EmailReportSettingsSection.4ba4b5')}</p>
                    <button
                        type="button"
                        className={RETRY_BUTTON}
                        onClick={refetch}
                    >
                        {t('EmailReportSettingsSection.0c767c')}
                    </button>
                </div>
            ) : (
                // 폼은 마운트 시점 값으로 시작하고 이후 refetch를 따라가지 않는다. 저장 응답으로
                // 캐시가 바뀔 때 다시 마운트하면 저장 버튼의 포커스와 상태 문구가 사라진다.
                // 다른 탭에서 바꾼 값은 마지막 저장이 이긴다.
                <SettingsForm initial={settings} save={save} />
            )}
        </div>
    );
}
