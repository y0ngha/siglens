/**
 * 보유 기관 수 추이 블록 — 제목·설명·선 그래프.
 */
import { useTranslations } from 'next-intl';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import {
    formatCompact,
    formatInteger,
    formatPeriodShort,
} from '../../utils/flowFormat';
import type { HoldersTrend } from '../../utils/institutional';
import { TrendLineChart } from '../charts/TrendLineChart';

/** 보유 기관 수 추이 블록. */
export function HoldersTrendChart({ trend }: { readonly trend: HoldersTrend }) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    return (
        <div>
            <h3 className={cn('mb-1', HEADING_SUBSECTION)}>
                {t('holdersTrend.title')}
            </h3>
            <p className="mb-3 text-xs text-secondary-400">
                {t('holdersTrend.caption')}
            </p>
            <TrendLineChart
                values={trend.values}
                ariaLabel={t('holdersTrend.aria', {
                    from: formatInteger(trend.first, locale),
                    to: formatInteger(trend.last, locale),
                })}
                maxLabel={formatCompact(trend.max, locale)}
                minLabel={formatCompact(trend.min, locale)}
                startLabel={formatPeriodShort(trend.startPeriod)}
                endLabel={formatPeriodShort(trend.endPeriod)}
            />
        </div>
    );
}
