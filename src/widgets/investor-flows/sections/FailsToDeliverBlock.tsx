/**
 * SEC 결제 불이행(FTD) 블록 — 수집 중·조회 불가·기록 없음·요약+막대 중 하나를 그린다.
 */
import { useTranslations } from 'next-intl';
import type { FailsToDeliverPoint, ShortMetrics } from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { FlowTooltip } from '../investorFlowsTooltips';
import { buildFailsToDeliverSeries } from '../utils/failsToDeliver';
import {
    formatCompact,
    formatInteger,
    formatMonthDay,
} from '../utils/flowFormat';
import { DailyBarChart } from '../ui/charts/DailyBarChart';
import { FtdSummaryStats } from '../ui/ftd/FtdSummaryStats';
import { CollectingNotice } from './CollectingNotice';

interface FailsToDeliverBlockProps {
    /** `null` = 조회 불가(실패가 없던 날은 행이 없을 뿐이라 `[]`과 다르다). */
    readonly points: readonly FailsToDeliverPoint[] | null;
    /** 점수표(core) 지표 — 최근 창 최대값의 발행주식 대비 %·기준선 대비 배수는 여기서만 읽는다. */
    readonly metrics: ShortMetrics;
    /** 첫 파일이 아직 저장되지 않았다(구간이 비어 있을 때만 참). */
    readonly collecting: boolean;
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
            <FtdSummaryStats latest={latest} metrics={metrics} />
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
