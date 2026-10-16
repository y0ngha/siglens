import { useTranslations } from 'next-intl';
import type { FailsToDeliverPoint, ShortMetrics } from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { DailyBarChart } from '../charts/DailyBarChart';
import { FlowTooltip } from '../investorFlowsTooltips';
import {
    formatCompact,
    formatDecimal,
    formatInteger,
    formatMonthDay,
    formatSmallPercent,
} from '../utils/flowFormat';
import { buildFailsToDeliverSeries } from '../utils/failsToDeliver';
import { CollectingNotice } from './CollectingNotice';

interface FailsToDeliverBlockProps {
    /** `null` = 조회 불가(실패가 없던 날은 행이 없을 뿐이라 `[]`과 다르다). */
    readonly points: readonly FailsToDeliverPoint[] | null;
    /** 점수표(core) 지표 — 최근 창 최대값의 발행주식 대비 %·기준선 대비 배수는 여기서만 읽는다. */
    readonly metrics: ShortMetrics;
    /** 첫 파일이 아직 저장되지 않았다(구간이 비어 있을 때만 참). */
    readonly collecting: boolean;
}

function Stat({
    label,
    value,
    caption,
}: {
    readonly label: string;
    readonly value: string;
    /** 값 아래 작은 글씨(최대치의 결제일 등). */
    readonly caption?: string;
}) {
    return (
        <li className={cn(SURFACE_NESTED, 'p-3')}>
            <p className="text-xs text-secondary-300">{label}</p>
            <p className="mt-1 text-sm font-semibold text-secondary-100 tabular-nums">
                {value}
            </p>
            {caption !== undefined && (
                <p className="mt-0.5 text-xs text-secondary-400 tabular-nums">
                    {caption}
                </p>
            )}
        </li>
    );
}

/**
 * 발행주식 대비 %의 표시 자리 — 대형주 FTD는 0.0006%처럼 작아 두 자리로 줄이면 "0.00%"가 된다. 1%의 1/100 미만이면 네 자리
 * (core 비율 정밀도)로 보인다.
 */
const SMALL_PCT_THRESHOLD = 0.01;
const PCT_DIGITS = 2;
const SMALL_PCT_DIGITS = 4;

function pctDigits(value: number): number {
    return Math.abs(value) < SMALL_PCT_THRESHOLD && value !== 0
        ? SMALL_PCT_DIGITS
        : PCT_DIGITS;
}

/** 수집 중 → 조회 불가 → 기록 없음 → 요약 + 막대 순으로 첫 해당 분기만 그린다. */
function FtdBody({ points, metrics, collecting }: FailsToDeliverBlockProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    if (collecting) return <CollectingNotice variant="failsToDeliver" />;
    if (points === null) {
        return (
            <p className="text-sm text-secondary-300">{t('ftd.unavailable')}</p>
        );
    }
    const series = buildFailsToDeliverSeries(points);
    const latest = series.latest;
    if (latest === null) {
        return (
            <p className="text-sm text-secondary-300">
                {t('ftd.none', {
                    days: formatInteger(series.windowDays, locale),
                })}
            </p>
        );
    }
    return (
        <>
            <p className="mb-3 text-xs text-secondary-400">
                {t('ftd.basis', { date: latest.settlementDate })}
            </p>
            <ul className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
                <Stat
                    label={t('ftd.latestQty')}
                    value={t('ftd.shares', {
                        shares: formatCompact(latest.failsQty, locale),
                    })}
                />
                {metrics.failsToDeliverPeakQty !== null && (
                    <Stat
                        label={t('ftd.peakQty')}
                        value={t('ftd.shares', {
                            shares: formatCompact(
                                metrics.failsToDeliverPeakQty,
                                locale
                            ),
                        })}
                        {...(metrics.failsToDeliverPeakDate === null
                            ? {}
                            : {
                                  caption: t('ftd.peakDate', {
                                      date: metrics.failsToDeliverPeakDate,
                                  }),
                              })}
                    />
                )}
                <Stat
                    label={t('ftd.peakPct')}
                    value={
                        metrics.failsToDeliverPctOutstanding === null
                            ? t('short.unknown')
                            : formatSmallPercent(
                                  metrics.failsToDeliverPctOutstanding,
                                  locale,
                                  pctDigits(
                                      metrics.failsToDeliverPctOutstanding
                                  )
                              )
                    }
                />
                <Stat
                    label={t('ftd.multiple')}
                    value={
                        metrics.failsToDeliverMultiple === null
                            ? t('short.unknown')
                            : t('ftd.times', {
                                  times: formatDecimal(
                                      metrics.failsToDeliverMultiple,
                                      locale,
                                      1
                                  ),
                              })
                    }
                />
            </ul>
            <DailyBarChart
                bars={series.rows.map(row => ({
                    date: row.settlementDate,
                    value: row.failsQty,
                }))}
                max={series.maxQty}
                ariaLabel={t('ftd.chartAria', { count: series.rows.length })}
                maxLabel={formatCompact(series.maxQty, locale)}
                zeroLabel={formatInteger(0, locale)}
                startLabel={formatMonthDay(series.rows[0].settlementDate)}
                endLabel={formatMonthDay(latest.settlementDate)}
            />
        </>
    );
}

/**
 * SEC 결제 불이행(FTD) — 결제일별 막대 + 최근 값 요약 + SEC 안내("무차입 공매도의 증거가 아니다") + 약 2주 공개 지연 설명.
 * 수집 중이면 안내 상자, 조회 불가면 "불러오지 못했어요", 행이 없으면 "최근 N일 동안 기록 없음"으로 갈라 말한다.
 */
export function FailsToDeliverBlock(props: FailsToDeliverBlockProps) {
    const t = useTranslations('widgets.investor-flows');
    return (
        <div data-testid="flows-ftd">
            <h3 className={cn('mb-1', HEADING_SUBSECTION)}>
                {t('ftd.title')}
                <FlowTooltip term="failsToDeliver" />
            </h3>
            <p className="mb-3 text-xs text-secondary-400">{t('ftd.lag')}</p>
            <FtdBody {...props} />
            <p className="mt-3 rounded-lg bg-secondary-700/40 p-3 text-xs leading-relaxed text-secondary-300">
                {t('ftd.caveat')}
            </p>
        </div>
    );
}
