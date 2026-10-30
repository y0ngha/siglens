/**
 * 공매도 잔고 변화 카드 — 직전 결제일 대비 증감, core 추세 라벨, 최근 3회 결제 변화율.
 */
import { useTranslations } from 'next-intl';
import type { ShortInterestTrend, ShortMetrics } from '@y0ngha/siglens-core';
import type { PreviousSettlementChange } from '@/entities/investor-flows/model';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import {
    formatSignedCompact,
    formatSignedPercent,
} from '../../utils/flowFormat';
import { ChangeBadge } from './ChangeBadge';

interface ShortChangeCardProps {
    readonly metrics: ShortMetrics;
    readonly previousChange: PreviousSettlementChange | null;
}

/**
 * 직전 결제일 대비 증감(배지·주식 수), core 추세 라벨(증가·감소·보합·혼조), 최근 3회 결제 변화율과 그 양 끝 결제일을 보인다.
 * 최근 3회 변화율(core `shortInterestChangePct`)은 양 끝 결제일과 함께만 보인다 — 날짜 없는 %는 기간을 알 수 없다.
 */
export function ShortChangeCard({
    metrics,
    previousChange,
}: ShortChangeCardProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    const trendLabels: Record<ShortInterestTrend, string> = {
        rising: t('short.trendRising'),
        falling: t('short.trendFalling'),
        flat: t('short.trendFlat'),
        mixed: t('short.trendMixed'),
    };
    const {
        shortInterestChangePct: recentPct,
        shortInterestChangeFromDate: recentFrom,
        shortInterestChangeToDate: recentTo,
        shortInterestTrend: trend,
    } = metrics;
    const recentChange =
        recentPct === null || recentFrom === null || recentTo === null
            ? null
            : t('short.recentChange', {
                  pct: formatSignedPercent(recentPct, locale),
                  from: recentFrom,
                  to: recentTo,
              });
    const previousPct = previousChange?.pct ?? null;
    return (
        <li className={cn(SURFACE_NESTED, 'p-3')}>
            <p className="text-xs text-secondary-300">{t('short.change')}</p>
            <p className="mt-1 text-sm font-medium text-secondary-100 tabular-nums">
                {previousPct === null ? (
                    t('short.noPreviousSettlement')
                ) : (
                    <ChangeBadge changePct={previousPct} />
                )}
            </p>
            {previousChange !== null && (
                <p className="mt-1 text-xs text-secondary-400 tabular-nums">
                    {t('short.changeVs', {
                        date: previousChange.previousDate,
                        shares: formatSignedCompact(
                            previousChange.sharesChange,
                            locale
                        ),
                    })}
                </p>
            )}
            {trend !== null && (
                <p className="mt-1 text-xs text-secondary-300">
                    {trendLabels[trend]}
                </p>
            )}
            {recentChange !== null && (
                <p className="mt-1 text-xs text-secondary-400 tabular-nums">
                    {recentChange}
                </p>
            )}
        </li>
    );
}
