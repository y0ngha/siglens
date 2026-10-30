'use client';

/**
 * 실적 비교 카드 그리드와 범례 — 카드들이 같은 최댓값 기준으로 막대를 그리도록 기준을 한 번만 계산한다.
 */
import { useTranslations } from 'next-intl';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import type { EarningsReportComparisonItem } from '@/shared/lib/types';
import { getMaxAbs } from '../../utils/earningsBars';
import { EarningsReportCard } from './EarningsReportCard';

interface EarningsReportComparisonProps {
    items: EarningsReportComparisonItem[];
}

/** 항목이 없으면 아무것도 그리지 않는다. */
export function EarningsReportComparison({
    items,
}: EarningsReportComparisonProps) {
    const t = useTranslations('widgets.news');
    if (items.length === 0) return null;

    const maxEps = getMaxAbs(
        items.flatMap(item => [item.epsActual, item.epsEstimated])
    );
    const maxRevenue = getMaxAbs(
        items.flatMap(item => [item.revenueActual, item.revenueEstimated])
    );

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div className="flex gap-3 text-xs text-secondary-400">
                    <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-ui-success" />
                        {t('EventCalendar.19aa63')}
                    </span>
                    <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-primary-400" />
                        {t('EventCalendar.a06069')}
                        <InfoTooltip className="ml-0 text-[11px]">
                            <p>{t('EventCalendar.6a5765')}</p>
                            <p>{t('EventCalendar.3e6c69')}</p>
                        </InfoTooltip>
                    </span>
                </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {items.map(item => (
                    <EarningsReportCard
                        key={`${item.symbol}-${item.earningsDate}`}
                        item={item}
                        maxEps={maxEps}
                        maxRevenue={maxRevenue}
                    />
                ))}
            </div>
        </div>
    );
}
