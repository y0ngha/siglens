'use client';

import type { KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';
import { useRovingKeyboardNav } from '@/components/hooks/useRovingKeyboardNav';
import type { DashboardTimeframe } from '@/domain/types';
import {
    DASHBOARD_TIMEFRAME_LABELS,
    DASHBOARD_TIMEFRAMES,
} from '@/domain/constants/dashboard-tickers';

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
    const handleKeyDown = useRovingKeyboardNav<DashboardTimeframe>({
        items: DASHBOARD_TIMEFRAMES,
        activeItem: timeframe,
        onChange,
        focusItem: focusRadioInGroup,
        withHomeEnd: false,
    });

    return (
        <div className="flex items-baseline gap-3">
            <span
                id={TIMEFRAME_LABEL_ID}
                className="text-secondary-500 text-[10px] tracking-wider uppercase"
            >
                타임프레임
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
                                'min-h-11 touch-manipulation border-b-2 px-2 pt-2 pb-2 text-xs font-semibold tracking-[0.12em] uppercase transition-colors duration-150',
                                isActive
                                    ? 'text-secondary-100 border-primary-500'
                                    : 'text-secondary-500 hover:text-secondary-300 border-transparent',
                                'focus-visible:ring-primary-500 rounded-t focus-visible:ring-2 focus-visible:outline-none'
                            )}
                        >
                            {DASHBOARD_TIMEFRAME_LABELS[tf]}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
