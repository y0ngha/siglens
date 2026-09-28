'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import type { OptionsChain } from '@y0ngha/siglens-core';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import { CallVolumeTooltip, PutVolumeTooltip } from './utils/optionsTooltips';
import { pickLabelIndices } from './utils/pickLabelIndices';
import { aggregateStrikeVolume } from './utils/aggregateStrikeVolume';
import { formatCompactCount } from './utils/formatCompactCount';
import {
    PEAK_LABEL_TOP_OFFSET_PX,
    CALL_LABEL_MIDLINE_OFFSET_PX,
    PUT_LABEL_MIDLINE_OFFSET_PX,
} from './utils/chartLabelOffsets';
import {
    MIDLINE_STROKE_WIDTH,
    GUIDE_LINE_STROKE_WIDTH,
} from './utils/chartStrokeWidths';
import {
    BAR_OPACITY,
    BAR_WIDTH_FILL_RATIO,
    CHART_HEIGHT,
    CHART_WIDTH,
    COLOR_CALL,
    COLOR_GUIDE_LINE,
    COLOR_LABEL,
    COLOR_MIDLINE,
    COLOR_PUT,
    HALF_HEIGHT,
    LABEL_CALL,
    LABEL_PUT,
    LABEL_ROTATION_THRESHOLD,
    MAX_X_AXIS_LABELS,
    MIDLINE_Y,
    PAD_BOTTOM,
    PAD_LEFT,
    PAD_RIGHT,
    PAD_TOP,
    ROTATED_LABEL_FONT_SIZE,
    STRAIGHT_LABEL_FONT_SIZE,
    SVG_HEIGHT,
    SVG_WIDTH,
    X_AXIS_LABEL_OFFSET_PX,
} from './utils/strikeChartLayout';
import { findNearestStrikeIndex } from '@/entities/options-chain/lib/findNearestStrike';
import { useStrikeBarChart } from './hooks/useStrikeBarChart';
import {
    barCenterX,
    barPixelHeight,
    slotWidth,
} from './lib/strikeChartGeometry';
import { StrikeBarTooltip } from './ui/StrikeBarTooltip';
import { StrikeBarSrTable } from './ui/StrikeBarSrTable';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { cn } from '@/shared/lib/cn';

interface StrikeVolumeChartProps {
    /** Spot price used to anchor the current-price guide line. */
    underlyingPrice: number;
    /** Chain matching the parent's selected expiration; null when absent. */
    chain: OptionsChain | null;
}

// 모든 strike의 volume이 0일 때 globalMax가 0이 되어 barPixelHeight에서
// 0으로 나누는 경로를 막기 위한 하한값. OpenInterestChart와 동일 패턴.
const MIN_VOLUME_SCALE_FLOOR = 1;

// OpenInterestChart의 `oi-chart-tooltip`과 충돌하지 않도록 자체 id 사용.
// 두 차트가 같은 페이지에 동시에 렌더되므로 id가 겹치면 `aria-describedby`
// anchor가 어느 tooltip을 가리키는지 모호해진다.
const TOOLTIP_ELEMENT_ID = 'volume-chart-tooltip';

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

    const derived = useMemo(() => {
        if (!chain) return null;
        const volumeByStrike = aggregateStrikeVolume(chain);
        if (volumeByStrike.length === 0) return null;

        // 전 strike의 volume이 모두 0인 케이스(주말·휴장·만기 갱신 직후)는
        // "차트는 그릴 수 있지만 정보가 0"인 상태이므로 비어있다는 안내로
        // 대체한다. OI 차트는 OI=0 만기가 거의 없으므로 동일 검사가 없지만,
        // volume은 휴장 직후 흔히 발생하는 경로.
        //
        // raw max를 한 번의 reduce로 구한 뒤 0이면 empty state, 아니면
        // MIN_VOLUME_SCALE_FLOOR로 클램프해 barPixelHeight의 0 나누기를
        // 막는다 — 두 번의 순회(some + reduce)를 한 번으로 합쳤다.
        const globalMaxRaw = volumeByStrike.reduce(
            (max, s) => Math.max(max, s.callVolume, s.putVolume),
            0
        );
        if (globalMaxRaw === 0) return null;
        const globalMax = Math.max(globalMaxRaw, MIN_VOLUME_SCALE_FLOOR);

        const strikes = volumeByStrike.map(s => s.strike);
        const currentPriceIdx = findNearestStrikeIndex(
            strikes,
            underlyingPrice
        );

        // Max Pain은 OI 개념이므로 volume 차트에는 적합하지 않다. anchors는
        // 현재가만 강제 포함. derived와 같은 메모 경계에서 한 번에 계산해
        // hover state가 바뀌어도 라벨 Set이 재생성되지 않도록 한다
        // (MISTAKES.md §10).
        const labelIndices = pickLabelIndices(
            volumeByStrike.length,
            [currentPriceIdx],
            MAX_X_AXIS_LABELS
        );

        return {
            volumeByStrike,
            globalMax,
            currentPriceIdx,
            labelIndices,
        };
    }, [chain, underlyingPrice]);

    if (!derived) {
        // 빈 상태도 OpenInterestChart와 동일한 카드 컨테이너로 감싼다 —
        // 두 차트가 lg+에서 grid-cols-2 sibling이 되므로 한쪽만 naked
        // paragraph로 떨어지면 셀 높이/시각 무게가 어긋난다. 텍스트 스타일도
        // OI 차트 빈 상태와 통일(`text-xs leading-relaxed`).
        return (
            <div className={cn(SURFACE_CARD, 'space-y-2 p-4')}>
                <span className="text-sm font-medium text-secondary-300">
                    {t('StrikeVolumeChart.5ceb49')}
                </span>
                <p className="text-xs leading-relaxed text-secondary-500">
                    {t('StrikeVolumeChart.7d0444')}
                </p>
            </div>
        );
    }

    const { volumeByStrike, globalMax, currentPriceIdx, labelIndices } =
        derived;
    const count = volumeByStrike.length;
    const sw = slotWidth(count, CHART_WIDTH);
    const bw = sw * BAR_WIDTH_FILL_RATIO;

    // hoveredIndex 가드 — 만기 chip 전환으로 배열이 짧아지는 사이 stale
    // index가 남아있어도 안전하게 null 처리한다.
    const hoveredRow =
        hoveredIndex !== null ? (volumeByStrike[hoveredIndex] ?? null) : null;

    const currentPriceX =
        currentPriceIdx >= 0
            ? barCenterX(currentPriceIdx, count, PAD_LEFT, CHART_WIDTH)
            : null;

    const rotateLabels = labelIndices.size > LABEL_ROTATION_THRESHOLD;
    const peakVolumeLabel = formatCompactCount(globalMax);

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
                aria-describedby="volume-chart-desc"
                className="block w-full"
            >
                <desc id="volume-chart-desc">
                    {t('StrikeVolumeChart.2156df')}
                </desc>

                <line
                    x1={PAD_LEFT}
                    y1={MIDLINE_Y}
                    x2={SVG_WIDTH - PAD_RIGHT}
                    y2={MIDLINE_Y}
                    stroke={COLOR_MIDLINE}
                    strokeWidth={MIDLINE_STROKE_WIDTH}
                />

                <text
                    x={PAD_LEFT}
                    y={PAD_TOP - PEAK_LABEL_TOP_OFFSET_PX}
                    fill={COLOR_LABEL}
                    fontSize={STRAIGHT_LABEL_FONT_SIZE}
                    textAnchor="start"
                >
                    {peakVolumeLabel}
                </text>

                <text
                    x={PAD_LEFT}
                    y={MIDLINE_Y - CALL_LABEL_MIDLINE_OFFSET_PX}
                    fill={LABEL_CALL}
                    fontSize={STRAIGHT_LABEL_FONT_SIZE}
                    textAnchor="start"
                >
                    ▲ Call Vol
                </text>

                <text
                    x={PAD_LEFT}
                    y={MIDLINE_Y + PUT_LABEL_MIDLINE_OFFSET_PX}
                    fill={LABEL_PUT}
                    fontSize={STRAIGHT_LABEL_FONT_SIZE}
                    textAnchor="start"
                >
                    ▼ Put Vol
                </text>

                {volumeByStrike.map((row, i) => {
                    const cx = barCenterX(i, count, PAD_LEFT, CHART_WIDTH);
                    const callH = barPixelHeight(
                        row.callVolume,
                        globalMax,
                        HALF_HEIGHT
                    );
                    const putH = barPixelHeight(
                        row.putVolume,
                        globalMax,
                        HALF_HEIGHT
                    );

                    return (
                        <g key={row.strike}>
                            {row.callVolume > 0 && (
                                <rect
                                    x={cx - bw / 2}
                                    y={MIDLINE_Y - callH}
                                    width={bw}
                                    height={callH}
                                    fill={COLOR_CALL}
                                    opacity={BAR_OPACITY}
                                />
                            )}
                            {row.putVolume > 0 && (
                                <rect
                                    x={cx - bw / 2}
                                    y={MIDLINE_Y}
                                    width={bw}
                                    height={putH}
                                    fill={COLOR_PUT}
                                    opacity={BAR_OPACITY}
                                />
                            )}
                            <rect
                                x={cx - sw / 2}
                                y={PAD_TOP}
                                width={sw}
                                height={CHART_HEIGHT}
                                fill="white"
                                fillOpacity={0}
                                pointerEvents="all"
                                aria-describedby={TOOLTIP_ELEMENT_ID}
                                onPointerEnter={e => handlePointerEnter(e, i)}
                                onPointerMove={e => handlePointerMove(e, i)}
                                onPointerLeave={handlePointerLeave}
                            />
                        </g>
                    );
                })}

                {currentPriceX !== null && (
                    <line
                        x1={currentPriceX}
                        y1={PAD_TOP}
                        x2={currentPriceX}
                        y2={SVG_HEIGHT - PAD_BOTTOM}
                        stroke={COLOR_GUIDE_LINE}
                        strokeWidth={GUIDE_LINE_STROKE_WIDTH}
                    />
                )}

                {volumeByStrike.map((row, i) => {
                    if (!labelIndices.has(i)) return null;
                    const cx = barCenterX(i, count, PAD_LEFT, CHART_WIDTH);
                    const labelY =
                        SVG_HEIGHT - PAD_BOTTOM + X_AXIS_LABEL_OFFSET_PX;

                    if (rotateLabels) {
                        return (
                            <text
                                key={`lbl-${row.strike}`}
                                x={cx}
                                y={labelY}
                                fill={COLOR_LABEL}
                                fontSize={ROTATED_LABEL_FONT_SIZE}
                                textAnchor="end"
                                transform={`rotate(-45, ${cx}, ${labelY})`}
                            >
                                {row.strike}
                            </text>
                        );
                    }

                    return (
                        <text
                            key={`lbl-${row.strike}`}
                            x={cx}
                            y={labelY}
                            fill={COLOR_LABEL}
                            fontSize={STRAIGHT_LABEL_FONT_SIZE}
                            textAnchor="middle"
                        >
                            {row.strike}
                        </text>
                    );
                })}
            </svg>

            <StrikeBarTooltip
                id={TOOLTIP_ELEMENT_ID}
                hoveredRow={hoveredRow}
                tooltipPos={tooltipPos}
            >
                {hoveredRow !== null && (
                    <>
                        <div className="mb-1 font-semibold text-secondary-300 tabular-nums">
                            Strike ${hoveredRow.strike.toLocaleString()}
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-ui-success-text">
                                Call Vol
                            </span>
                            <span className="tabular-nums">
                                {t('StrikeVolumeChart.e3558e', {
                                    v0: hoveredRow.callVolume.toLocaleString(),
                                })}
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-ui-danger-text">Put Vol</span>
                            <span className="tabular-nums">
                                {t('StrikeVolumeChart.e3558e', {
                                    v0: hoveredRow.putVolume.toLocaleString(),
                                })}
                            </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-3 border-t border-secondary-700 pt-1">
                            <span className="text-secondary-400">
                                {t('StrikeVolumeChart.3dcb27')}
                            </span>
                            <span className="font-semibold tabular-nums">
                                {t('StrikeVolumeChart.e3558e', {
                                    v0: (
                                        hoveredRow.callVolume +
                                        hoveredRow.putVolume
                                    ).toLocaleString(),
                                })}
                            </span>
                        </div>
                    </>
                )}
            </StrikeBarTooltip>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-secondary-500">
                <span className="flex items-center gap-1">
                    <span
                        className="inline-block h-2.5 w-2.5 rounded bg-chart-bullish"
                        aria-hidden="true"
                    />
                    Call Vol
                    <InfoTooltip>{CallVolumeTooltip}</InfoTooltip>
                </span>
                <span className="flex items-center gap-1">
                    <span
                        className="inline-block h-2.5 w-2.5 rounded bg-chart-bearish"
                        aria-hidden="true"
                    />
                    Put Vol
                    <InfoTooltip>{PutVolumeTooltip}</InfoTooltip>
                </span>
                <span className="flex items-center gap-1">
                    <span
                        className="inline-block w-[14px] border-t-[1.5px] border-solid border-ui-warning"
                        aria-hidden="true"
                    />
                    {t('StrikeVolumeChart.497d1e')}
                </span>
            </div>

            <StrikeBarSrTable
                caption={t('StrikeVolumeChart.f5c9b8')}
                headers={['Strike', 'Call Volume', 'Put Volume']}
                rows={volumeByStrike.map(row => ({
                    key: row.strike,
                    cells: [row.strike, row.callVolume, row.putVolume],
                }))}
            />
        </div>
    );
}
