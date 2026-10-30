'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import type { Weekday } from '@/entities/email-report/model';
import { cn } from '@/shared/lib/cn';
import type { WeekdayOption } from '../hooks/useEmailReportSettingsForm';
import { FIELD_LABEL } from './fieldLabelStyle';

interface WeekdayPickerProps {
    readonly options: readonly WeekdayOption[];
    /** 수신이 꺼져 요일을 고를 수 없다. 칩은 비활성 토큰으로 보이되 고른 요일은 채움으로 남는다. */
    readonly disabled: boolean;
    readonly onToggle: (day: Weekday) => void;
}

type ChipTone = 'on' | 'off' | 'onDisabled' | 'offDisabled';

// 비활성은 `opacity-*`가 아니라 명시 토큰으로 낸다(DESIGN.md#DS-3) — 불투명도는 글자와 경계를
// 함께 배경 쪽으로 끌어 대비를 무너뜨린다.
const CHIP_TONE: Record<ChipTone, string> = {
    on: 'cursor-pointer border-primary-500 bg-primary-600/15 font-semibold text-secondary-50',
    off: 'cursor-pointer border-border-control text-secondary-300 hover:bg-secondary-800',
    onDisabled:
        'cursor-not-allowed border-border-control bg-secondary-700 font-semibold text-secondary-500',
    offDisabled: 'cursor-not-allowed border-border-control text-secondary-500',
};

const CHIP =
    'inline-flex h-10 min-w-11 items-center justify-center rounded-lg border px-3 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-500';

function chipTone(checked: boolean, disabled: boolean): ChipTone {
    if (disabled) return checked ? 'onDisabled' : 'offDisabled';
    return checked ? 'on' : 'off';
}

/**
 * 받을 요일 칩 묶음(`EmailReportSettingsForm`). 체크박스는 시각적으로 숨기고 라벨 칩이 보인다.
 * 마지막 남은 요일은 끌 수 없어 그 칸만 비활성이며, 그 이유는 묶음에 연결된 안내가 읽힌다.
 */
export function WeekdayPicker({
    options,
    disabled,
    onToggle,
}: WeekdayPickerProps) {
    const t = useTranslations('features.email-report-settings');
    const hintId = useId();
    return (
        <fieldset disabled={disabled} aria-describedby={hintId}>
            <legend className={FIELD_LABEL}>
                {t('EmailReportSettingsSection.b081bb')}
            </legend>
            <div className="flex flex-wrap gap-2">
                {options.map(({ day, label, checked, isOnlyDay }) => (
                    <label
                        key={day}
                        className={cn(
                            CHIP,
                            CHIP_TONE[chipTone(checked, disabled)]
                        )}
                    >
                        <input
                            type="checkbox"
                            className="sr-only"
                            checked={checked}
                            disabled={isOnlyDay}
                            onChange={() => onToggle(day)}
                        />
                        {label}
                    </label>
                ))}
            </div>
            <p id={hintId} className="mt-2 text-xs text-secondary-400">
                {t('EmailReportSettingsSection.f1ce16')}
            </p>
        </fieldset>
    );
}
