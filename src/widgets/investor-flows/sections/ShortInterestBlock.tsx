/**
 * 공매도 잔고·상환일수(결제일별) 블록 — 최신 값 카드와 결제일별 추이 그래프를 묶는다.
 */
import { useTranslations } from 'next-intl';
import type { ShortMetrics } from '@y0ngha/siglens-core';
import type { PreviousSettlementChange } from '@/entities/investor-flows/model';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { FlowTooltip } from '../investorFlowsTooltips';
import {
    formatCompact,
    formatDecimal,
    formatPercent,
} from '../utils/flowFormat';
import type { ShortInterestRow } from '../utils/short';
import { buildShortInterestChartModel } from '../utils/shortInterestChart';
import { ShortChangeCard } from '../ui/short/ShortChangeCard';
import { ShortInterestCharts } from '../ui/short/ShortInterestCharts';
import { ShortStatCard } from '../ui/short/ShortStatCard';

/** 유통주식 대비 잔고 %의 소수 자리. */
const PCT_FLOAT_DIGITS = 2;
/** 상환일수의 소수 자리. */
const DAYS_TO_COVER_DIGITS = 1;

interface ShortInterestBlockProps {
    /** 결제일 오름차순, 비어 있지 않다(부모가 거른다). */
    readonly rows: readonly ShortInterestRow[];
    /** 점수표(core) 지표 — 최신 값 숫자(유통주식 대비 %·상환일수·변화율)는 여기서만 읽는다. */
    readonly metrics: ShortMetrics;
    /** 직전 결제일 대비 변화 — 에이전트 도구와 같은 함수의 값. 비교할 결제일이 없으면 `null`. */
    readonly previousChange: PreviousSettlementChange | null;
}

/** 공매도 잔고·상환일수(결제일별): 최신 값 카드 4장 + 결제일별 추이 그래프 2개. */
export function ShortInterestBlock({
    rows,
    metrics,
    previousChange,
}: ShortInterestBlockProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    const latest = rows[rows.length - 1];
    const chartModel = buildShortInterestChartModel(rows);
    return (
        <div>
            <h3 className={cn('mb-1', HEADING_SUBSECTION)}>
                {t('short.interestTitle')}
            </h3>
            <p className="mb-3 text-xs text-secondary-400">
                {t('short.interestBasis', { date: latest.settlementDate })}
                <FlowTooltip term="settlementDate" />
            </p>
            <ul className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
                <ShortStatCard label={t('short.qty')}>
                    {formatCompact(latest.shortQty, locale)}
                </ShortStatCard>
                <ShortStatCard label={t('short.pctFloat')} tooltip="pctOfFloat">
                    {metrics.shortInterestPctFloat === null
                        ? t('short.unknown')
                        : formatPercent(
                              metrics.shortInterestPctFloat,
                              locale,
                              PCT_FLOAT_DIGITS
                          )}
                </ShortStatCard>
                <ShortStatCard
                    label={t('short.daysToCover')}
                    tooltip="daysToCover"
                >
                    {metrics.daysToCover === null
                        ? t('short.unknown')
                        : t('short.days', {
                              days: formatDecimal(
                                  metrics.daysToCover,
                                  locale,
                                  DAYS_TO_COVER_DIGITS
                              ),
                          })}
                </ShortStatCard>
                <ShortChangeCard
                    metrics={metrics}
                    previousChange={previousChange}
                />
            </ul>
            {chartModel !== null && (
                <ShortInterestCharts
                    model={chartModel}
                    pointCount={rows.length}
                />
            )}
        </div>
    );
}
