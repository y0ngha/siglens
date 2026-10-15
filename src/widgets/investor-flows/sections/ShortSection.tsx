import { useId } from 'react';
import { useTranslations } from 'next-intl';
import type {
    InvestorFlowsScorecard,
    ShortInterestPoint,
    ShortVolumePoint,
} from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { computePreviousSettlementChange } from '@/entities/investor-flows/lib/shortInterestChange';
import { FlowTooltip } from '../investorFlowsTooltips';
import { formatDecimal, formatPercent } from '../utils/flowFormat';
import {
    buildShortInterestRows,
    buildShortVolumeSeries,
    shortVolumeMarker,
} from '../utils/short';
import { ShortInterestBlock } from './ShortInterestBlock';
import { ShortVolumeBlock } from './ShortVolumeBlock';

const HEADING_ID = 'flows-short-heading';

interface ShortSectionProps {
    readonly shortInterest: readonly ShortInterestPoint[] | null;
    readonly shortVolume: readonly ShortVolumePoint[] | null;
    readonly floatShares: number | null;
    readonly scorecard: InvestorFlowsScorecard;
}

/**
 * 공매도 섹션(FINRA). **부모가 `hasShortData`로 걸러서** 부를 때만 렌더한다 — 플래그가 꺼졌거나 데이터가 없는
 * 종목에서 빈 껍데기를 그리지 않기 위해서다. 안에서도 블록마다 데이터가 있을 때만 그린다.
 * 최신 값 숫자는 점수표(core `short.metrics`)에서 읽고, 결제일별 추이 점만 여기서 계산한다.
 */
export function ShortSection({
    shortInterest,
    shortVolume,
    floatShares,
    scorecard,
}: ShortSectionProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    const squeezeId = useId();
    const rows = buildShortInterestRows(shortInterest ?? [], floatShares);
    const series = buildShortVolumeSeries(shortVolume ?? []);
    const metrics = scorecard.short.metrics;

    return (
        <section
            aria-labelledby={HEADING_ID}
            className={cn(SURFACE_CARD, 'space-y-6 p-6')}
        >
            <div>
                <h2 id={HEADING_ID} className={HEADING_SECTION}>
                    {t('short.title')}
                    <FlowTooltip term="shortInterest" />
                </h2>
                <p className="mt-1 text-xs text-secondary-400">
                    {t('short.subtitle')}
                </p>
            </div>

            {metrics.squeezeRisk && (
                <div
                    role="note"
                    aria-labelledby={squeezeId}
                    className="rounded-lg border border-ui-warning/40 bg-ui-warning/10 p-3"
                >
                    <p
                        id={squeezeId}
                        className="text-sm font-medium text-ui-warning-text"
                    >
                        <span aria-hidden="true">⚠ </span>
                        {t('short.squeezeBadge')}
                        <FlowTooltip term="shortSqueeze" />
                    </p>
                    <p className="mt-1 text-xs text-secondary-300">
                        {t('short.squeezeNote', {
                            pct:
                                metrics.shortInterestPctFloat === null
                                    ? '–'
                                    : formatPercent(
                                          metrics.shortInterestPctFloat,
                                          locale,
                                          1
                                      ),
                            days:
                                metrics.daysToCover === null
                                    ? '–'
                                    : formatDecimal(
                                          metrics.daysToCover,
                                          locale,
                                          1
                                      ),
                        })}
                    </p>
                </div>
            )}

            {rows.length > 0 && (
                <ShortInterestBlock
                    rows={rows}
                    metrics={metrics}
                    previousChange={computePreviousSettlementChange(
                        shortInterest ?? []
                    )}
                />
            )}
            <ShortVolumeBlock
                series={series}
                marker={shortVolumeMarker(scorecard)}
            />
        </section>
    );
}
