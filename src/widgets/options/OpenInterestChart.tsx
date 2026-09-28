'use client';

import { useTranslations } from 'next-intl';
import {
    CALL_LABEL_MIDLINE_OFFSET_PX,
    PEAK_LABEL_TOP_OFFSET_PX,
    PUT_LABEL_MIDLINE_OFFSET_PX,
} from './utils/chartLabelOffsets';
import {
    GUIDE_LINE_STROKE_WIDTH,
    MIDLINE_STROKE_WIDTH,
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
import { TOOLTIP_ELEMENT_ID } from './utils/computeTooltipPos';
import { formatCompactCount } from './utils/formatCompactCount';
import {
    CallOpenInterestTooltip,
    OpenInterestTooltip,
    PutOpenInterestTooltip,
} from './utils/optionsTooltips';
import { pickLabelIndices } from './utils/pickLabelIndices';
import { useStrikeBarChart } from './hooks/useStrikeBarChart';
import {
    barCenterX,
    barPixelHeight,
    slotWidth,
} from './lib/strikeChartGeometry';
import { StrikeBarTooltip } from './ui/StrikeBarTooltip';
import { StrikeBarSrTable } from './ui/StrikeBarSrTable';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import { findNearestStrikeIndex } from '@/entities/options-chain/lib/findNearestStrike';
import {
    aggregateOpenInterest,
    type OptionsChain,
    type OptionsExpirationMetrics,
} from '@y0ngha/siglens-core';
import { useMemo } from 'react';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { cn } from '@/shared/lib/cn';

interface OpenInterestChartProps {
    /** Spot price used to anchor the current-price guide line. */
    underlyingPrice: number;
    /** Chain matching the parent's selected expiration; null when absent. */
    chain: OptionsChain | null;
    /** Pre-computed metrics — `maxPain` drives the dashed guide line. */
    metrics: OptionsExpirationMetrics | null;
}

// 상위 OI 강조는 기본 불투명도(`BAR_OPACITY`)와 1.0의 차이로 읽힌다.
const BAR_OPACITY_TOP_OI = 1;

// 모든 strike의 OI가 0일 때 globalMax 가 0이 되어 barPixelHeight에서
// 0으로 나누는 경로를 막기 위한 하한값.
const MIN_OI_SCALE_FLOOR = 1;

// 가장 OI가 두꺼운 상위 N개 strike만 강조해 시각적으로 두드러지게 한다.
const TOP_OI_STRIKE_COUNT = 3;

export function OpenInterestChart({
    underlyingPrice,
    chain,
    metrics,
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

    const derived = useMemo(() => {
        if (!chain) return null;
        const oiByStrike = aggregateOpenInterest(chain);
        if (oiByStrike.length === 0) return null;

        // 모든 strike의 OI가 0이면 차트를 그려도 막대가 안 나오므로 빈
        // 메시지 분기로 떨어뜨려 사용자에게 정규장 시간 안내를 보여준다.
        // `.every()`로 첫 비-zero strike에서 short-circuit — 합계가 필요한 게
        // 아니라 "모두 0인가"만 확인하면 충분하다.
        if (
            oiByStrike.every(
                s => s.callOpenInterest === 0 && s.putOpenInterest === 0
            )
        )
            return null;

        const maxPain = metrics?.maxPain ?? null;

        const topOiSet = new Set<number>(
            oiByStrike
                .toSorted(
                    (a, b) =>
                        b.callOpenInterest +
                        b.putOpenInterest -
                        (a.callOpenInterest + a.putOpenInterest)
                )
                .slice(0, TOP_OI_STRIKE_COUNT)
                .map(x => x.strike)
        );

        // Single pass through oiByStrike yields the max of either side; the
        // earlier two-`Math.max(...spread)` form re-iterated and allocated two
        // intermediate arrays, and spreading large arrays into Math.max risks
        // hitting the JS engine's argument-length cap on long chains.
        const globalMax = oiByStrike.reduce(
            (max, s) => Math.max(max, s.callOpenInterest, s.putOpenInterest),
            MIN_OI_SCALE_FLOOR
        );

        const strikes = oiByStrike.map(s => s.strike);
        // siglens-core R12: maxPain is now `number | null` (was `number` with
        // NaN sentinel). null → skip the marker entirely; otherwise locate the
        // closest strike for the dashed guide line.
        const maxPainIdx =
            maxPain === null ? -1 : findNearestStrikeIndex(strikes, maxPain);
        const currentPriceIdx = findNearestStrikeIndex(
            strikes,
            underlyingPrice
        );

        // derived와 같은 메모 경계에서 라벨 인덱스 Set도 한 번에 계산해
        // hover state가 바뀌어도 Set이 재생성되지 않도록 한다
        // (MISTAKES.md §10).
        const labelIndices = pickLabelIndices(
            oiByStrike.length,
            [maxPainIdx, currentPriceIdx],
            MAX_X_AXIS_LABELS
        );

        return {
            oiByStrike,
            topOiSet,
            globalMax,
            maxPainIdx,
            currentPriceIdx,
            labelIndices,
        };
    }, [chain, metrics, underlyingPrice]);

    if (!derived) {
        // 빈 상태에서도 정상 헤더(`Open Interest 분포 (Strike별)`)를 유지해
        // sibling Volume 차트의 빈 상태와 시각 흐름이 일치하도록 한다.
        //
        // `derived === null` 경로는 세 가지: (1) chain 미선택 (2) strike 0개
        // (3) 모든 strike OI=0. 운영상 (1)은 호출부에서 chain을 항상 넘기므로
        // 사실상 차단되고, (2)는 Yahoo가 만기를 추가했지만 strike 메타데이터를
        // 아직 채우지 못한 직후의 일시적 케이스로 (3)과 동일하게 정규장 외
        // stale-quote 시그니처에 해당한다. 세 경로 모두 사용자 대응법
        // (정규장 시간에 재확인)이 같아 메시지를 통합한다.
        return (
            <div className={cn(SURFACE_CARD, 'space-y-2 p-4')}>
                <span className="text-sm font-medium text-secondary-300">
                    {t('OpenInterestChart.f0220d')}
                </span>
                <p className="text-xs leading-relaxed text-secondary-500">
                    {t('OpenInterestChart.0f1ff5')}
                </p>
            </div>
        );
    }

    const {
        oiByStrike,
        topOiSet,
        globalMax,
        maxPainIdx,
        currentPriceIdx,
        labelIndices,
    } = derived;
    const count = oiByStrike.length;
    const sw = slotWidth(count, CHART_WIDTH);
    const bw = sw * BAR_WIDTH_FILL_RATIO;

    // hoveredIndex 가드: oiByStrike가 chip 전환으로 짧아지는 사이에 hover state
    // 가 stale이 되면 `oiByStrike[hoveredIndex]`가 undefined가 될 수 있다.
    // `??`로 정규화해 "배열 범위 초과 → null" 의도를 명시(`||`의 암묵적 falsy
    // 처리에 의존하지 않음 — row 객체는 항상 truthy라 의미 차이는 없지만
    // 표현이 더 정확하다).
    const hoveredRow =
        hoveredIndex !== null ? (oiByStrike[hoveredIndex] ?? null) : null;

    const maxPainX =
        maxPainIdx >= 0
            ? barCenterX(maxPainIdx, count, PAD_LEFT, CHART_WIDTH)
            : null;
    const currentPriceX =
        currentPriceIdx >= 0
            ? barCenterX(currentPriceIdx, count, PAD_LEFT, CHART_WIDTH)
            : null;

    const rotateLabels = labelIndices.size > LABEL_ROTATION_THRESHOLD;
    const peakOiLabel = formatCompactCount(globalMax);

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
                aria-describedby="oi-chart-desc"
                className="block w-full"
            >
                <desc id="oi-chart-desc">{t('OpenInterestChart.c9d602')}</desc>

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
                    {peakOiLabel}
                </text>

                <text
                    x={PAD_LEFT}
                    y={MIDLINE_Y - CALL_LABEL_MIDLINE_OFFSET_PX}
                    fill={LABEL_CALL}
                    fontSize={STRAIGHT_LABEL_FONT_SIZE}
                    textAnchor="start"
                >
                    ▲ Call OI
                </text>

                <text
                    x={PAD_LEFT}
                    y={MIDLINE_Y + PUT_LABEL_MIDLINE_OFFSET_PX}
                    fill={LABEL_PUT}
                    fontSize={STRAIGHT_LABEL_FONT_SIZE}
                    textAnchor="start"
                >
                    ▼ Put OI
                </text>

                {oiByStrike.map((row, i) => {
                    const cx = barCenterX(i, count, PAD_LEFT, CHART_WIDTH);
                    const isTopOi = topOiSet.has(row.strike);
                    const opacity = isTopOi ? BAR_OPACITY_TOP_OI : BAR_OPACITY;
                    const callH = barPixelHeight(
                        row.callOpenInterest,
                        globalMax,
                        HALF_HEIGHT
                    );
                    const putH = barPixelHeight(
                        row.putOpenInterest,
                        globalMax,
                        HALF_HEIGHT
                    );

                    return (
                        <g key={row.strike}>
                            {row.callOpenInterest > 0 && (
                                <rect
                                    x={cx - bw / 2}
                                    y={MIDLINE_Y - callH}
                                    width={bw}
                                    height={callH}
                                    fill={COLOR_CALL}
                                    opacity={opacity}
                                />
                            )}
                            {row.putOpenInterest > 0 && (
                                <rect
                                    x={cx - bw / 2}
                                    y={MIDLINE_Y}
                                    width={bw}
                                    height={putH}
                                    fill={COLOR_PUT}
                                    opacity={opacity}
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

                {maxPainX !== null && (
                    <line
                        x1={maxPainX}
                        y1={PAD_TOP}
                        x2={maxPainX}
                        y2={SVG_HEIGHT - PAD_BOTTOM}
                        stroke={COLOR_GUIDE_LINE}
                        strokeWidth={GUIDE_LINE_STROKE_WIDTH}
                        strokeDasharray="4 4"
                    />
                )}

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

                {oiByStrike.map((row, i) => {
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
                                Call OI
                            </span>
                            <span className="tabular-nums">
                                {t('OpenInterestChart.e3558e', {
                                    v0: hoveredRow.callOpenInterest.toLocaleString(),
                                })}
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-ui-danger-text">Put OI</span>
                            <span className="tabular-nums">
                                {t('OpenInterestChart.e3558e', {
                                    v0: hoveredRow.putOpenInterest.toLocaleString(),
                                })}
                            </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-3 border-t border-secondary-700 pt-1">
                            <span className="text-secondary-400">
                                {t('OpenInterestChart.3dcb27')}
                            </span>
                            <span className="font-semibold tabular-nums">
                                {t('OpenInterestChart.e3558e', {
                                    v0: (
                                        hoveredRow.callOpenInterest +
                                        hoveredRow.putOpenInterest
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
                    Call OI
                    <InfoTooltip>{CallOpenInterestTooltip}</InfoTooltip>
                </span>
                <span className="flex items-center gap-1">
                    <span
                        className="inline-block h-2.5 w-2.5 rounded bg-chart-bearish"
                        aria-hidden="true"
                    />
                    Put OI
                    <InfoTooltip>{PutOpenInterestTooltip}</InfoTooltip>
                </span>
                <span className="flex items-center gap-1">
                    <span
                        className="inline-block w-[14px] border-t-[1.5px] border-dashed border-ui-warning"
                        aria-hidden="true"
                    />
                    Max Pain
                </span>
                <span className="flex items-center gap-1">
                    <span
                        className="inline-block w-[14px] border-t-[1.5px] border-solid border-ui-warning"
                        aria-hidden="true"
                    />
                    {t('OpenInterestChart.497d1e')}
                </span>
            </div>

            <StrikeBarSrTable
                caption={t('OpenInterestChart.a33e7f')}
                headers={['Strike', 'Call OI', 'Put OI']}
                rows={oiByStrike.map(row => ({
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
