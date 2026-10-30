'use client';

/**
 * 실적 발표 한 건의 카드 — 발표일, 상태 라벨, 서프라이즈 배지, EPS·매출 막대.
 */
import { useTranslations } from 'next-intl';
import type { EarningsReportComparisonItem } from '@/shared/lib/types';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import {
    formatCurrency,
    formatRevenue,
    formatShortDate,
} from '../../utils/earningsFormat';
import { getSurpriseBadge } from '../../utils/surpriseBadge';
import { MetricBars } from './MetricBars';
import { SurpriseBadge } from './SurpriseBadge';

interface EarningsReportCardProps {
    item: EarningsReportComparisonItem;
    maxEps: number;
    maxRevenue: number;
}

/** 통화 판정에는 항목이 든 `symbol`을 쓴다 — 한 심볼의 비교 데이터라 항상 같다. */
export function EarningsReportCard({
    item,
    maxEps,
    maxRevenue,
}: EarningsReportCardProps) {
    const t = useTranslations('widgets.news');
    const locale = useResolvedLocale();
    const isFuture = item.period === 'future';
    const surpriseBadge = getSurpriseBadge(item);

    return (
        <article className={cn(SURFACE_CARD, 'p-4')}>
            <div className="flex min-h-10 items-start justify-between gap-3">
                <div>
                    <p className="text-xs text-secondary-400">
                        {isFuture
                            ? t('EventCalendar.7ba954')
                            : t('EventCalendar.f8f294')}
                    </p>
                    <time
                        dateTime={item.earningsDate}
                        className="font-semibold tabular-nums"
                    >
                        {formatShortDate(item.earningsDate, locale)}
                    </time>
                </div>
                <div className="flex flex-wrap justify-end gap-1">
                    <span className="rounded-full border border-secondary-600 px-2 py-0.5 text-xs text-secondary-300">
                        {isFuture
                            ? t('EventCalendar.7ba954')
                            : t('EventCalendar.c0c9e1')}
                    </span>
                    {surpriseBadge !== null ? (
                        <SurpriseBadge badge={surpriseBadge} />
                    ) : null}
                </div>
            </div>
            <div className="mt-4 space-y-4">
                <MetricBars
                    label="EPS"
                    actual={item.epsActual}
                    estimated={item.epsEstimated}
                    maxValue={maxEps}
                    format={value => formatCurrency(value, item.symbol)}
                    signed
                />
                <MetricBars
                    label={t('EventCalendar.191145')}
                    actual={item.revenueActual}
                    estimated={item.revenueEstimated}
                    maxValue={maxRevenue}
                    format={value => formatRevenue(value, item.symbol, locale)}
                />
            </div>
        </article>
    );
}
