'use client';

import { useCallback } from 'react';
import { cn } from '@/lib/cn';
import type { DashboardTimeframe } from '@/domain/types';
import {
    DASHBOARD_TIMEFRAMES,
    DASHBOARD_TIMEFRAME_LABELS,
} from '@/domain/constants/dashboard-tickers';

interface TimeframeSelectorProps {
    timeframe: DashboardTimeframe;
    onChange: (next: DashboardTimeframe) => void;
}

export function TimeframeSelector({
    timeframe,
    onChange,
}: TimeframeSelectorProps) {
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLButtonElement>) => {
            const idx = DASHBOARD_TIMEFRAMES.indexOf(timeframe);
            const total = DASHBOARD_TIMEFRAMES.length;
            const nextIdx =
                e.key === 'ArrowRight'
                    ? (idx + 1) % total
                    : e.key === 'ArrowLeft'
                      ? (idx - 1 + total) % total
                      : -1;
            if (nextIdx !== -1) {
                e.preventDefault();
                onChange(DASHBOARD_TIMEFRAMES[nextIdx]);
                const parent = e.currentTarget.closest('[role="radiogroup"]');
                const buttons =
                    parent?.querySelectorAll<HTMLElement>('[role="radio"]');
                buttons?.[nextIdx]?.focus();
            }
        },
        [onChange, timeframe]
    );

    return (
        <div className="flex items-baseline gap-3">
            <span
                id="timeframe-label"
                className="text-secondary-500 text-[10px] tracking-wider uppercase"
            >
                타임프레임
            </span>
            <div
                role="radiogroup"
                aria-labelledby="timeframe-label"
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
