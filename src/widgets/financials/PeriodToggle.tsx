'use client';

import { useTranslations } from 'next-intl';
import type { StatementPeriod } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';

const PERIODS: StatementPeriod[] = ['annual', 'quarter'];

/** `widgets.financials.periodToggle` 키. */
const PERIOD_LABEL_KEY: Record<StatementPeriod, string> = {
    annual: 'annual',
    quarter: 'quarter',
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
    const t = useTranslations('widgets.financials');
    const tPeriod = useTranslations('widgets.financials.periodToggle');
    return (
        <div
            role="group"
            aria-label={t('PeriodToggle.1e8c39')}
            className="flex items-center gap-1"
        >
            {PERIODS.map(period => (
                <button
                    key={period}
                    type="button"
                    aria-pressed={period === value}
                    onClick={() => onChange(period)}
                    className={cn(
                        'focus-visible:ring-primary-500 inline-flex min-h-11 touch-manipulation items-center justify-center rounded border px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none',
                        period === value
                            ? 'border-primary-400 text-primary-400'
                            : 'text-secondary-400 hover:text-secondary-200 border-transparent'
                    )}
                >
                    {tPeriod(PERIOD_LABEL_KEY[period])}
                </button>
            ))}
        </div>
    );
}
