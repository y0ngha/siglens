'use client';

/**
 * Open-interest-by-strike chart. Orchestrates the view model, the pointer
 * hook and the shared strike-chart pieces; drawing details live in `ui/`.
 */
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type {
    OptionsExpirationMetrics,
    StrikeOpenInterest,
} from '@y0ngha/siglens-core';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { cn } from '@/shared/lib/cn';
import { useStrikeBarChart } from './hooks/useStrikeBarChart';
import { STRIKE_CHART_ELEMENT_IDS } from './utils/chartElementIds';
import { formatCompactCount } from './utils/formatCompactCount';
import { buildOpenInterestChartModel } from './utils/openInterestChartModel';
import { OpenInterestTooltip } from './utils/optionsTooltips';
import { BAR_OPACITY, SVG_HEIGHT, SVG_WIDTH } from './utils/strikeChartLayout';
import { OpenInterestLegend } from './ui/oi-chart/OpenInterestLegend';
import { OpenInterestTooltipBody } from './ui/oi-chart/OpenInterestTooltipBody';
import { ChartEmptyCard } from './ui/strike-chart/ChartEmptyCard';
import { StrikeAxisLabels } from './ui/strike-chart/StrikeAxisLabels';
import { StrikeBars } from './ui/strike-chart/StrikeBars';
import { StrikeBarSrTable } from './ui/StrikeBarSrTable';
import { StrikeBarTooltip } from './ui/StrikeBarTooltip';
import { StrikeChartScale } from './ui/strike-chart/StrikeChartScale';
import { StrikeGuideLines } from './ui/strike-chart/StrikeGuideLines';

interface OpenInterestChartProps {
    /** Spot price used to anchor the current-price guide line. */
    underlyingPrice: number;
    /** Per-strike OI for the selected expiration; empty when there is no chain. */
    oiByStrike: ReadonlyArray<StrikeOpenInterest>;
    /** Pre-computed metrics — `maxPain` drives the dashed guide line. */
    metrics: OptionsExpirationMetrics | null;
    /**
     * `true` when the OI snapshot is stale. Max Pain is then untrustworthy (the
     * metrics row hides it), so the guide line and legend entry are omitted
     * too; the bars stay.
     */
    oiStale: boolean;
}

// 상위 OI 강조는 기본 불투명도(`BAR_OPACITY`)와 1.0의 차이로 읽힌다.
const BAR_OPACITY_TOP_OI = 1;

const IDS = STRIKE_CHART_ELEMENT_IDS.openInterest;

/** strike별 콜·풋 미결제약정 분포 — 막대·가이드선·축 라벨·툴팁·스크린 리더 표를 조합한다. */
export function OpenInterestChart({
    underlyingPrice,
    oiByStrike,
    metrics,
    oiStale,
}: OpenInterestChartProps) {
    const t = useTranslations('widgets.options');
    const {
        containerRef,
        hoveredIndex,
        tooltipPos,
        handlePointerEnter,
        handlePointerMove,
        handlePointerLeave,
    } = useStrikeBarChart();

    const maxPain = oiStale ? null : (metrics?.maxPain ?? null);
    // 같은 메모 경계에서 라벨 인덱스 Set까지 만들어 hover state 변화에
    // Set이 재생성되지 않게 한다(REACT.md#CR-1).
    const model = useMemo(
        () => buildOpenInterestChartModel(oiByStrike, maxPain, underlyingPrice),
        [oiByStrike, maxPain, underlyingPrice]
    );
    const bars = useMemo(
        () =>
            model?.rows.map(row => ({
                strike: row.strike,
                call: row.callOpenInterest,
                put: row.putOpenInterest,
                opacity: model.topOiStrikes.has(row.strike)
                    ? BAR_OPACITY_TOP_OI
                    : BAR_OPACITY,
            })),
        [model]
    );

    // 빈 상태(체인 없음·strike 0개·전 strike OI=0)는 사용자 대응이 모두
    // "정규장 시간에 재확인"이라 한 메시지로 통합한다.
    if (!model || !bars) {
        return (
            <ChartEmptyCard
                title={t('OpenInterestChart.f0220d')}
                message={t('OpenInterestChart.0f1ff5')}
            />
        );
    }

    const { rows, globalMax, maxPainIdx, currentPriceIdx, labelIndices } =
        model;
    // 칩 전환으로 rows가 짧아지는 사이 hover index가 stale할 수 있다.
    const hoveredRow =
        hoveredIndex !== null ? (rows[hoveredIndex] ?? null) : null;

    return (
        <div
            ref={containerRef}
            className={cn(SURFACE_CARD, 'relative space-y-2 p-4')}
        >
            <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-secondary-300">
                    {t('OpenInterestChart.f0220d')}
                </span>
                <InfoTooltip>{OpenInterestTooltip}</InfoTooltip>
            </div>

            <svg
                viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                role="img"
                aria-label={t('OpenInterestChart.4948b9')}
                aria-describedby={IDS.desc}
                className="block w-full"
            >
                <desc id={IDS.desc}>{t('OpenInterestChart.c9d602')}</desc>
                <StrikeChartScale
                    peakLabel={formatCompactCount(globalMax)}
                    callLabel="▲ Call OI"
                    putLabel="▼ Put OI"
                />
                <StrikeBars
                    bars={bars}
                    globalMax={globalMax}
                    tooltipId={IDS.tooltip}
                    onPointerEnter={handlePointerEnter}
                    onPointerMove={handlePointerMove}
                    onPointerLeave={handlePointerLeave}
                />
                <StrikeGuideLines
                    count={rows.length}
                    currentPriceIdx={currentPriceIdx}
                    maxPainIdx={maxPainIdx}
                />
                <StrikeAxisLabels
                    strikes={rows.map(row => row.strike)}
                    labelIndices={labelIndices}
                />
            </svg>

            <StrikeBarTooltip
                id={IDS.tooltip}
                hoveredRow={hoveredRow}
                tooltipPos={tooltipPos}
            >
                {hoveredRow !== null && (
                    <OpenInterestTooltipBody row={hoveredRow} />
                )}
            </StrikeBarTooltip>

            <OpenInterestLegend showMaxPain={maxPainIdx >= 0} />

            <StrikeBarSrTable
                caption={t('OpenInterestChart.a33e7f')}
                headers={['Strike', 'Call OI', 'Put OI']}
                rows={rows.map(row => ({
                    key: row.strike,
                    cells: [
                        row.strike,
                        row.callOpenInterest,
                        row.putOpenInterest,
                    ],
                }))}
            />
        </div>
    );
}
