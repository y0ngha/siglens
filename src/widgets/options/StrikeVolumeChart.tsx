'use client';

/**
 * Trade-volume-by-strike chart. Orchestrates the view model, the pointer hook
 * and the shared strike-chart pieces; drawing details live in `ui/`.
 */
import { useMemo } from 'react';
import { STRIKE_CHART_ELEMENT_IDS } from './utils/chartElementIds';
import { useTranslations } from 'next-intl';
import type { ClientOptionsChain } from '@/entities/options-chain/lib/clientOptionsSnapshot';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { cn } from '@/shared/lib/cn';
import { useStrikeBarChart } from './hooks/useStrikeBarChart';
import { formatCompactCount } from './utils/formatCompactCount';
import { BAR_OPACITY, SVG_HEIGHT, SVG_WIDTH } from './utils/strikeChartLayout';
import { buildStrikeVolumeChartModel } from './utils/strikeVolumeChartModel';
import { ChartEmptyCard } from './ui/strike-chart/ChartEmptyCard';
import { StrikeAxisLabels } from './ui/strike-chart/StrikeAxisLabels';
import { StrikeBars } from './ui/strike-chart/StrikeBars';
import { StrikeBarSrTable } from './ui/StrikeBarSrTable';
import { StrikeBarTooltip } from './ui/StrikeBarTooltip';
import { StrikeChartScale } from './ui/strike-chart/StrikeChartScale';
import { StrikeGuideLines } from './ui/strike-chart/StrikeGuideLines';
import { StrikeVolumeLegend } from './ui/volume-chart/StrikeVolumeLegend';
import { StrikeVolumeTooltipBody } from './ui/volume-chart/StrikeVolumeTooltipBody';

interface StrikeVolumeChartProps {
    /** Spot price used to anchor the current-price guide line. */
    underlyingPrice: number;
    /** Chain matching the parent's selected expiration; null when absent. */
    chain: ClientOptionsChain | null;
}

const IDS = STRIKE_CHART_ELEMENT_IDS.volume;

/** strike별 콜·풋 거래량 분포 — 막대·현재가 가이드선·축 라벨·툴팁·스크린 리더 표를 조합한다. */
export function StrikeVolumeChart({
    underlyingPrice,
    chain,
}: StrikeVolumeChartProps) {
    const t = useTranslations('widgets.options');
    const {
        containerRef,
        hoveredIndex,
        tooltipPos,
        handlePointerEnter,
        handlePointerMove,
        handlePointerLeave,
    } = useStrikeBarChart();

    // 같은 메모 경계에서 라벨 인덱스 Set까지 만들어 hover state 변화에
    // Set이 재생성되지 않게 한다(REACT.md#CR-1).
    const model = useMemo(
        () => buildStrikeVolumeChartModel(chain, underlyingPrice),
        [chain, underlyingPrice]
    );
    const bars = useMemo(
        () =>
            model?.rows.map(row => ({
                strike: row.strike,
                call: row.callVolume,
                put: row.putVolume,
                opacity: BAR_OPACITY,
            })),
        [model]
    );

    // 휴장·만기 갱신 직후처럼 volume이 전부 0인 경우도 이 빈 상태로 떨어진다.
    if (!model || !bars) {
        return (
            <ChartEmptyCard
                title={t('StrikeVolumeChart.5ceb49')}
                message={t('StrikeVolumeChart.7d0444')}
            />
        );
    }

    const { rows, globalMax, currentPriceIdx, labelIndices } = model;
    // 칩 전환으로 rows가 짧아지는 사이 hover index가 stale할 수 있다.
    const hoveredRow =
        hoveredIndex !== null ? (rows[hoveredIndex] ?? null) : null;

    return (
        <div
            ref={containerRef}
            className={cn(SURFACE_CARD, 'relative space-y-2 p-4')}
        >
            <span className="text-sm font-medium text-secondary-300">
                {t('StrikeVolumeChart.5ceb49')}
            </span>

            <svg
                viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                role="img"
                aria-label={t('StrikeVolumeChart.75cc47')}
                aria-describedby={IDS.desc}
                className="block w-full"
            >
                <desc id={IDS.desc}>{t('StrikeVolumeChart.2156df')}</desc>
                <StrikeChartScale
                    peakLabel={formatCompactCount(globalMax)}
                    callLabel="▲ Call Vol"
                    putLabel="▼ Put Vol"
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
                    <StrikeVolumeTooltipBody row={hoveredRow} />
                )}
            </StrikeBarTooltip>

            <StrikeVolumeLegend />

            <StrikeBarSrTable
                caption={t('StrikeVolumeChart.f5c9b8')}
                headers={['Strike', 'Call Volume', 'Put Volume']}
                rows={rows.map(row => ({
                    key: row.strike,
                    cells: [row.strike, row.callVolume, row.putVolume],
                }))}
            />
        </div>
    );
}
