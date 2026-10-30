'use client';

/**
 * 연간/분기 분할 토글.
 */
import { useTranslations } from 'next-intl';
import type { StatementPeriod } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';

const PERIODS: StatementPeriod[] = ['annual', 'quarter'];

/** 선택된 버튼과 선택되지 않은 버튼의 색 클래스. */
const SELECTED_CLASS = 'border-primary-400 text-primary-400';
const UNSELECTED_CLASS =
    'text-secondary-400 hover:text-secondary-200 border-transparent';

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
 * 재무제표 페이지의 연간/분기 분할 토글.
 *
 * `TimeframeSelector` 패턴을 따라 `aria-pressed`를 가진 `<button>` 묶음이다. 각 버튼이 따로
 * 포커스되고 Enter/Space로 동작하며(네이티브 버튼), 바깥 `<div role="group">`이 스크린리더에
 * 묶음으로 알린다.
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
                        period === value ? SELECTED_CLASS : UNSELECTED_CLASS
                    )}
                >
                    {tPeriod(PERIOD_LABEL_KEY[period])}
                </button>
            ))}
        </div>
    );
}
