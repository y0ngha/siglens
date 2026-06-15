'use client';

import type { StatementPeriod } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';

const PERIODS: StatementPeriod[] = ['annual', 'quarter'];

const PERIOD_LABEL: Record<StatementPeriod, string> = {
    annual: '연간',
    quarter: '분기',
};

interface PeriodToggleProps {
    value: StatementPeriod;
    onChange: (period: StatementPeriod) => void;
}

/**
 * Segmented annual/quarter toggle for the financials page.
 *
 * Mirrors the `TimeframeSelector` pattern: a group of `<button>` elements
 * with `aria-pressed` for current selection state.
 *
 * Keyboard: each button is individually focusable and activates on Enter/Space
 * (native button behaviour). The outer `<div role="group">` groups them for
 * screen reader announcement.
 */
export function PeriodToggle({ value, onChange }: PeriodToggleProps) {
    return (
        <div
            role="group"
            aria-label="조회 기간"
            className="flex items-center gap-1"
        >
            {PERIODS.map(period => (
                <button
                    key={period}
                    type="button"
                    aria-pressed={period === value}
                    onClick={() => onChange(period)}
                    className={cn(
                        'focus-visible:ring-primary-500 touch-manipulation rounded border px-3 py-1 text-sm font-medium transition-colors focus-visible:ring-1',
                        period === value
                            ? 'border-primary-400 text-primary-400'
                            : 'text-secondary-400 hover:text-secondary-200 border-transparent'
                    )}
                >
                    {PERIOD_LABEL[period]}
                </button>
            ))}
        </div>
    );
}
