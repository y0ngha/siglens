'use client';

/**
 * 한 지표(EPS·매출)의 실제치/추정치 막대 쌍.
 */
import { useTranslations } from 'next-intl';
import { MetricBar } from './MetricBar';

interface MetricBarsProps {
    label: string;
    actual: number | null;
    estimated: number | null;
    maxValue: number;
    format: (value: number | null) => string;
    signed?: boolean;
}

/** 실제치(성공색)와 추정치(주색) 막대를 같은 `maxValue` 기준으로 나란히 그린다. */
export function MetricBars({
    label,
    actual,
    estimated,
    maxValue,
    format,
    signed = false,
}: MetricBarsProps) {
    const t = useTranslations('widgets.news');
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-medium text-secondary-300">{label}</span>
            </div>
            <div className="space-y-1.5">
                <MetricBar
                    label={t('EventCalendar.19aa63')}
                    value={actual}
                    maxValue={maxValue}
                    format={format}
                    className="bg-ui-success"
                    signed={signed}
                />
                <MetricBar
                    label={t('EventCalendar.a06069')}
                    value={estimated}
                    maxValue={maxValue}
                    format={format}
                    className="bg-primary-400"
                    signed={signed}
                />
            </div>
        </div>
    );
}
