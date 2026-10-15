import { useTranslations } from 'next-intl';
import type { ShortInterestTrend, ShortMetrics } from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { TrendLineChart } from '../charts/TrendLineChart';
import { FlowTooltip } from '../investorFlowsTooltips';
import {
    formatCompact,
    formatDecimal,
    formatMonthDay,
    formatPercent,
    formatSignedCompact,
    formatSignedPercent,
} from '../utils/flowFormat';
import {
    changeDirection,
    type ChangeDirection,
    type ShortInterestRow,
} from '../utils/short';
import type { PreviousSettlementChange } from '@/entities/investor-flows/model';

/** 색과 별개로 붙는 방향 기호. */
const DIRECTION_MARK: Record<ChangeDirection, string> = {
    up: '▲',
    down: '▼',
    flat: '■',
};

function ChangeBadge({ changePct }: { readonly changePct: number }) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    const direction = changeDirection(changePct);
    const mark = DIRECTION_MARK[direction];
    // 라벨은 리터럴 `t()` 호출로 만들어 두고 방향으로 고른다(추출기가 키를 볼 수 있게).
    const labels: Record<ChangeDirection, string> = {
        up: t('short.changeUp'),
        down: t('short.changeDown'),
        flat: t('short.changeFlat'),
    };
    return (
        <span className="inline-flex items-center gap-1">
            <span aria-hidden="true">{mark}</span>
            <span className="font-mono">
                {formatSignedPercent(changePct, locale, 1)}
            </span>
            <span className="text-xs font-normal text-secondary-300">
                {labels[direction]}
            </span>
        </span>
    );
}

function StatCard({
    label,
    tooltip,
    children,
}: {
    readonly label: string;
    readonly tooltip?: 'pctOfFloat' | 'daysToCover';
    readonly children: React.ReactNode;
}) {
    return (
        <li className={cn(SURFACE_NESTED, 'p-3')}>
            <p className="text-xs text-secondary-300">
                {label}
                {tooltip !== undefined && <FlowTooltip term={tooltip} />}
            </p>
            <p className="mt-1 text-lg font-semibold text-secondary-100 tabular-nums">
                {children}
            </p>
        </li>
    );
}

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
    const trendLabels: Record<ShortInterestTrend, string> = {
        rising: t('short.trendRising'),
        falling: t('short.trendFalling'),
        flat: t('short.trendFlat'),
    };
    const latest = rows[rows.length - 1];
    const hasFloat = latest.pctOfFloat !== null;
    const chartValues = rows.map(row =>
        hasFloat ? row.pctOfFloat : row.shortQty
    );
    const finite = chartValues.filter((v): v is number => v !== null);
    const dtc = rows
        .map(row => row.daysToCover)
        .filter((v): v is number => v !== null);
    const endLabel = formatMonthDay(latest.settlementDate);
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
                <StatCard label={t('short.qty')}>
                    {formatCompact(latest.shortQty, locale)}
                </StatCard>
                <StatCard label={t('short.pctFloat')} tooltip="pctOfFloat">
                    {metrics.shortInterestPctFloat === null
                        ? t('short.unknown')
                        : formatPercent(
                              metrics.shortInterestPctFloat,
                              locale,
                              2
                          )}
                </StatCard>
                <StatCard label={t('short.daysToCover')} tooltip="daysToCover">
                    {metrics.daysToCover === null
                        ? t('short.unknown')
                        : t('short.days', {
                              days: formatDecimal(
                                  metrics.daysToCover,
                                  locale,
                                  1
                              ),
                          })}
                </StatCard>
                <li className={cn(SURFACE_NESTED, 'p-3')}>
                    <p className="text-xs text-secondary-300">
                        {t('short.change')}
                    </p>
                    <p className="mt-1 text-sm font-medium text-secondary-100 tabular-nums">
                        {previousChange === null ||
                        previousChange.pct === null ? (
                            t('short.noPreviousSettlement')
                        ) : (
                            <ChangeBadge changePct={previousChange.pct} />
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
                    {metrics.shortInterestTrend !== null && (
                        <p className="mt-1 text-xs text-secondary-300">
                            {trendLabels[metrics.shortInterestTrend]}
                        </p>
                    )}
                </li>
            </ul>
            {rows.length > 1 && finite.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2">
                    <div>
                        <p className="mb-1 text-xs font-medium text-secondary-300">
                            {hasFloat
                                ? t('short.chartPctFloat')
                                : t('short.chartQty')}
                        </p>
                        <TrendLineChart
                            values={chartValues}
                            ariaLabel={t('short.chartAria', {
                                count: rows.length,
                            })}
                            maxLabel={
                                hasFloat
                                    ? formatPercent(
                                          Math.max(...finite),
                                          locale,
                                          1
                                      )
                                    : formatCompact(Math.max(...finite), locale)
                            }
                            minLabel={
                                hasFloat
                                    ? formatPercent(
                                          Math.min(...finite),
                                          locale,
                                          1
                                      )
                                    : formatCompact(Math.min(...finite), locale)
                            }
                            startLabel={rows[0].settlementDate}
                            endLabel={endLabel}
                        />
                    </div>
                    {dtc.length > 0 && (
                        <div>
                            <p className="mb-1 text-xs font-medium text-secondary-300">
                                {t('short.chartDaysToCover')}
                            </p>
                            <TrendLineChart
                                values={rows.map(row => row.daysToCover)}
                                ariaLabel={t('short.chartDtcAria', {
                                    count: rows.length,
                                })}
                                maxLabel={formatDecimal(
                                    Math.max(...dtc),
                                    locale,
                                    1
                                )}
                                minLabel={formatDecimal(
                                    Math.min(...dtc),
                                    locale,
                                    1
                                )}
                                startLabel={rows[0].settlementDate}
                                endLabel={endLabel}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
