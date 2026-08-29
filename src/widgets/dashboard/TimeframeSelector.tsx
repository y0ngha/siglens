'use client';

import { useTranslations } from 'next-intl';
import type { KeyboardEvent } from 'react';
import { cn } from '@/shared/lib/cn';
import { LABEL_KO } from '@/shared/lib/typographyStyles';
import { useRovingKeyboardNav } from '@/shared/hooks/useRovingKeyboardNav';
import type { DashboardTimeframe } from '@y0ngha/siglens-core';
import { DASHBOARD_TIMEFRAMES } from '@/shared/config/dashboard-tickers';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { timeframeLabel } from '@/shared/lib/timeframeLabel';

interface TimeframeSelectorProps {
    timeframe: DashboardTimeframe;
    onChange: (next: DashboardTimeframe) => void;
}

const TIMEFRAME_LABEL_ID = 'timeframe-label';

function focusRadioInGroup(
    next: DashboardTimeframe,
    e: KeyboardEvent<Element>
): void {
    const idx = DASHBOARD_TIMEFRAMES.indexOf(next);
    const parent = e.currentTarget.closest('[role="radiogroup"]');
    const buttons = parent?.querySelectorAll<HTMLElement>('[role="radio"]');
    buttons?.[idx]?.focus();
}

export function TimeframeSelector({
    timeframe,
    onChange,
}: TimeframeSelectorProps) {
    const t = useTranslations('widgets.dashboard');
    const locale = useResolvedLocale();
    const handleKeyDown = useRovingKeyboardNav<DashboardTimeframe>({
        items: DASHBOARD_TIMEFRAMES,
        activeItem: timeframe,
        onChange,
        focusItem: focusRadioInGroup,
        withHomeEnd: false,
    });

    return (
        <div className="flex items-baseline gap-3">
            <span id={TIMEFRAME_LABEL_ID} className={LABEL_KO}>
                {t('TimeframeSelector.756aa5')}
            </span>
            <div
                role="radiogroup"
                aria-labelledby={TIMEFRAME_LABEL_ID}
                className="flex gap-3"
            >
                {DASHBOARD_TIMEFRAMES.map(tf => {
                    const isActive = tf === timeframe;
                    return (
                        <button
                            key={tf}
                            role="radio"
                            aria-checked={isActive}
                            tabIndex={isActive ? 0 : -1}
                            onClick={() => onChange(tf)}
                            onKeyDown={handleKeyDown}
                            className={cn(
                                // 라벨이 `15분`·`1시간`·`1일`이라 uppercase는 무효고
                                // 0.12em 자간은 한글을 흩뜨린다. 크기는 12px로는
                                // 작아 14px로 올린다(`min-h-11`이라 높이는 불변).
                                'min-h-11 touch-manipulation border-b-2 px-2 pt-2 pb-2 text-sm font-semibold transition-colors duration-150',
                                isActive
                                    ? 'text-secondary-100 border-primary-500'
                                    : 'text-secondary-500 hover:text-secondary-300 border-transparent',
                                'focus-visible:ring-primary-500 rounded-t focus-visible:ring-2 focus-visible:outline-none'
                            )}
                        >
                            {timeframeLabel(tf, locale)}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
