'use client';

import {
    CALL_LABEL_MIDLINE_OFFSET_PX,
    PEAK_LABEL_TOP_OFFSET_PX,
    PUT_LABEL_MIDLINE_OFFSET_PX,
} from './utils/chartLabelOffsets';
import {
    GUIDE_LINE_STROKE_WIDTH,
    MIDLINE_STROKE_WIDTH,
} from './utils/chartStrokeWidths';
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
import { findNearestStrikeIndex } from '@/entities/options-chain';
import {
    aggregateOpenInterest,
    type OptionsChain,
    type OptionsExpirationMetrics,
} from '@y0ngha/siglens-core';
import { useMemo } from 'react';

interface OpenInterestChartProps {
    /** Spot price used to anchor the current-price guide line. */
    underlyingPrice: number;
    /** Chain matching the parent's selected expiration; null when absent. */
    chain: OptionsChain | null;
    /** Pre-computed metrics — `maxPain` drives the dashed guide line. */
    metrics: OptionsExpirationMetrics | null;
}

// SVG 레이아웃 상수는 StrikeVolumeChart와 동일하게 복제한다 — 두 차트가
// 나란히 렌더되면서 같은 viewport / 같은 막대 비율을 공유해야 사용자가
// 두 차트를 비교하는 시선 흐름이 어색해지지 않는다. 상수를 별도 유틸로
// 빼지 않는 이유: 추후 어느 한쪽 차트의 패딩만 미세조정할 가능성이
// 충분히 있고, 한 변경이 두 차트에 동시에 영향을 주는 결합도를 미리
// 만들 필요는 없다.
const SVG_WIDTH = 600;
const SVG_HEIGHT = 240;
const PAD_TOP = 30;
const PAD_BOTTOM = 50;
const PAD_LEFT = 12;
const PAD_RIGHT = 12;

const CHART_WIDTH = SVG_WIDTH - PAD_LEFT - PAD_RIGHT;
const CHART_HEIGHT = SVG_HEIGHT - PAD_TOP - PAD_BOTTOM;
const MIDLINE_Y = PAD_TOP + CHART_HEIGHT / 2;
const HALF_HEIGHT = CHART_HEIGHT / 2;

// Semantic chart tokens — referenced directly because SVG attributes
// (`fill`, `stroke`) don't consume Tailwind classes targeting `color`.
// Max Pain and the current-price line intentionally share `ui-warning`
// since both communicate "pivot levels worth watching"; the dashed vs
// solid stroke pattern differentiates them visually.
const COLOR_CALL = 'var(--color-chart-bullish)';
const COLOR_PUT = 'var(--color-chart-bearish)';
const COLOR_GUIDE_LINE = 'var(--color-ui-warning)';
const COLOR_MIDLINE = 'var(--color-secondary-600)';
const COLOR_LABEL = 'var(--color-secondary-500)';

const BAR_OPACITY_DEFAULT = 0.7;
const BAR_OPACITY_TOP_OI = 1;

// 모든 strike의 OI가 0일 때 globalMax 가 0이 되어 barPixelHeight에서
// 0으로 나누는 경로를 막기 위한 하한값.
const MIN_OI_SCALE_FLOOR = 1;

// 가장 OI가 두꺼운 상위 N개 strike만 강조해 시각적으로 두드러지게 한다.
const TOP_OI_STRIKE_COUNT = 3;

// 슬롯 너비 대비 막대 두께 비율 — 슬롯 양쪽에 약간의 간격을 남겨
// 인접 strike와 시각적으로 구분되도록 한다.
const BAR_WIDTH_FILL_RATIO = 0.7;

// x축에 동시에 보여줄 라벨 최대 개수. PLTR 같은 weekly + LEAPS 종목은
// strike 수가 30~50개에 달해 모든 라벨을 그리면 글자가 겹치고 시각적으로
// 답답해진다. 이 값을 기준으로 균등하게 thinning하고, 현재가·Max Pain·양 끝
// strike는 항상 표시되도록 보존한다.
const MAX_X_AXIS_LABELS = 10;

// 라벨 thinning 후에도 글자 길이를 줄여 가독성을 확보하기 위한 회전 임계값.
// 라벨 개수가 이 임계값 이상이면 -45° 회전한다.
const LABEL_ROTATION_THRESHOLD = 7;

// x축 라벨을 차트 영역 하단에서 띄울 px 거리. font baseline 위치 보정.
const X_AXIS_LABEL_OFFSET_PX = 14;
// 가독성을 잃지 않는 한도에서, 회전 라벨은 한 글자만큼 작게 잡는다.
const ROTATED_LABEL_FONT_SIZE = 8;
const STRAIGHT_LABEL_FONT_SIZE = 9;

export function OpenInterestChart({
    underlyingPrice,
    chain,
    metrics,
}: OpenInterestChartProps) {
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
            <div className="border-secondary-700 bg-secondary-800 space-y-2 rounded-xl border p-4">
                <span className="text-secondary-300 text-sm font-medium">
                    Open Interest 분포 (Strike별)
                </span>
                <p className="text-secondary-500 text-xs leading-relaxed">
                    이 만기에는 OI 데이터가 없어요.
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
            className="border-secondary-700 bg-secondary-800 relative space-y-2 rounded-xl border p-4"
        >
            <div className="flex items-center gap-1">
                <span className="text-secondary-300 text-sm font-medium">
                    Open Interest 분포 (Strike별)
                </span>
                <InfoTooltip>{OpenInterestTooltip}</InfoTooltip>
            </div>

            <svg
                viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                role="img"
                aria-labelledby="oi-chart-title oi-chart-desc"
                className="block w-full"
            >
                <title id="oi-chart-title">Strike별 Open Interest 분포</title>
                <desc id="oi-chart-desc">
                    Call과 Put의 만기별 OI를 strike 가격대별로 막대그래프로
                    표시합니다. Max Pain과 현재 주가는 세로선으로 강조됩니다.
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
                    {peakOiLabel}
                </text>

                <text
                    x={PAD_LEFT}
                    y={MIDLINE_Y - CALL_LABEL_MIDLINE_OFFSET_PX}
                    fill={COLOR_CALL}
                    fontSize={STRAIGHT_LABEL_FONT_SIZE}
                    textAnchor="start"
                >
                    ▲ Call OI
                </text>

                <text
                    x={PAD_LEFT}
                    y={MIDLINE_Y + PUT_LABEL_MIDLINE_OFFSET_PX}
                    fill={COLOR_PUT}
                    fontSize={STRAIGHT_LABEL_FONT_SIZE}
                    textAnchor="start"
                >
                    ▼ Put OI
                </text>

                {oiByStrike.map((row, i) => {
                    const cx = barCenterX(i, count, PAD_LEFT, CHART_WIDTH);
                    const isTopOi = topOiSet.has(row.strike);
                    const opacity = isTopOi
                        ? BAR_OPACITY_TOP_OI
                        : BAR_OPACITY_DEFAULT;
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
                        <div className="text-secondary-300 mb-1 font-semibold tabular-nums">
                            Strike ${hoveredRow.strike.toLocaleString()}
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-chart-bullish">Call OI</span>
                            <span className="tabular-nums">
                                {hoveredRow.callOpenInterest.toLocaleString()}{' '}
                                계약
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-chart-bearish">Put OI</span>
                            <span className="tabular-nums">
                                {hoveredRow.putOpenInterest.toLocaleString()}{' '}
                                계약
                            </span>
                        </div>
                        <div className="border-secondary-700 mt-1 flex items-center justify-between gap-3 border-t pt-1">
                            <span className="text-secondary-400">합계</span>
                            <span className="font-semibold tabular-nums">
                                {(
                                    hoveredRow.callOpenInterest +
                                    hoveredRow.putOpenInterest
                                ).toLocaleString()}{' '}
                                계약
                            </span>
                        </div>
                    </>
                )}
            </StrikeBarTooltip>

            <div className="text-secondary-500 mt-2 flex flex-wrap items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1">
                    <span
                        className="bg-chart-bullish inline-block h-2.5 w-2.5 rounded-sm"
                        aria-hidden="true"
                    />
                    Call OI
                    <InfoTooltip>{CallOpenInterestTooltip}</InfoTooltip>
                </span>
                <span className="flex items-center gap-1">
                    <span
                        className="bg-chart-bearish inline-block h-2.5 w-2.5 rounded-sm"
                        aria-hidden="true"
                    />
                    Put OI
                    <InfoTooltip>{PutOpenInterestTooltip}</InfoTooltip>
                </span>
                <span className="flex items-center gap-1">
                    <span
                        className="border-ui-warning inline-block w-[14px] border-t-[1.5px] border-dashed"
                        aria-hidden="true"
                    />
                    Max Pain
                </span>
                <span className="flex items-center gap-1">
                    <span
                        className="border-ui-warning inline-block w-[14px] border-t-[1.5px] border-solid"
                        aria-hidden="true"
                    />
                    현재가
                </span>
            </div>

            <StrikeBarSrTable
                caption="Strike별 Open Interest 데이터"
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
