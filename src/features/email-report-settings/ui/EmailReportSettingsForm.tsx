'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import type { EmailReportSettingsView } from '@/entities/email-report/model';
import { BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { NativeSelect } from '@/shared/ui/NativeSelect';
import {
    type SaveMutation,
    useEmailReportSettingsForm,
} from '../hooks/useEmailReportSettingsForm';
import { FIELD_LABEL } from './fieldLabelStyle';
import { WeekdayPicker } from './WeekdayPicker';

interface EmailReportSettingsFormProps {
    /** 폼이 시작하는 값. 마운트 뒤 바뀌어도 따라가지 않는다(`EmailReportSettingsSection` 참고). */
    readonly initial: EmailReportSettingsView;
    readonly save: SaveMutation;
}

// 저장 중에는 `disabled`가 아니라 `aria-disabled`라 채움 버튼의 비활성 모양을 그 속성에도 단다.
const SAVE_BUTTON = cn(
    BUTTON_PRIMARY,
    'h-10 px-4 text-sm aria-disabled:cursor-not-allowed aria-disabled:bg-secondary-700 aria-disabled:text-secondary-500 aria-disabled:hover:bg-secondary-700 aria-disabled:active:bg-secondary-700'
);

/**
 * 메일 리포트 수신 설정 폼 — 수신 스위치, 받을 요일, 받을 시각, 저장. 상태와 저장 흐름은
 * `useEmailReportSettingsForm`이 갖는다.
 */
export function EmailReportSettingsForm({
    initial,
    save,
}: EmailReportSettingsFormProps) {
    const t = useTranslations('features.email-report-settings');
    const toggleId = useId();
    const hourId = useId();
    const statusId = useId();
    const form = useEmailReportSettingsForm(initial, save);

    return (
        <form onSubmit={form.handleSubmit} className="space-y-5" noValidate>
            {/* 체크박스를 문장 앞에 둔다 — 폼의 다른 선택(요일)처럼 왼쪽 정렬로 읽히게. */}
            <div className="flex items-start gap-3 rounded-lg bg-secondary-900/60 p-4 ring-1 ring-secondary-700">
                <input
                    id={toggleId}
                    type="checkbox"
                    role="switch"
                    checked={form.enabled}
                    aria-checked={form.enabled}
                    onChange={form.handleEnabledChange}
                    className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-primary-600"
                />
                <div>
                    <label
                        htmlFor={toggleId}
                        className="text-sm font-semibold text-secondary-100"
                    >
                        {t('EmailReportSettingsSection.633367')}
                    </label>
                    <p className="mt-1 text-sm text-secondary-400">
                        {t('EmailReportSettingsSection.8d4110', {
                            v0: form.symbolLimits.full,
                            v1: form.symbolLimits.brief,
                        })}
                    </p>
                </div>
            </div>

            <div className="space-y-5">
                <WeekdayPicker
                    options={form.weekdayOptions}
                    disabled={!form.enabled}
                    onToggle={form.handleDayToggle}
                />

                <div>
                    <label htmlFor={hourId} className={FIELD_LABEL}>
                        {t('EmailReportSettingsSection.f0cf28')}
                    </label>
                    <NativeSelect
                        wrapperClassName="w-full sm:w-40"
                        id={hourId}
                        value={form.sendHour}
                        disabled={!form.enabled}
                        onChange={form.handleHourChange}
                    >
                        {form.hourOptions.map(({ value, label }) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </NativeSelect>
                    <p className="mt-2 text-xs text-secondary-400">
                        {t('EmailReportSettingsSection.a4c309', {
                            v0: form.timezone,
                        })}
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                {/* 저장 중에도 `disabled`로 바꾸지 않는다 — 포커스를 쥔 버튼이 disabled가 되면
                    포커스가 body로 떨어진다(REACT.md#AX-3). 중복 제출은 훅의 제출 가드가 막는다. */}
                <button
                    type="submit"
                    className={SAVE_BUTTON}
                    aria-disabled={form.isSaving || undefined}
                    aria-describedby={statusId}
                >
                    {form.isSaving
                        ? t('EmailReportSettingsSection.9f6785')
                        : t('EmailReportSettingsSection.1f1712')}
                </button>
                <p
                    id={statusId}
                    role="status"
                    aria-live="polite"
                    className={cn(
                        'min-h-5 text-sm',
                        form.message?.tone === 'error'
                            ? 'text-ui-danger-text'
                            : 'text-secondary-300'
                    )}
                >
                    {form.message?.text}
                </p>
            </div>
        </form>
    );
}
