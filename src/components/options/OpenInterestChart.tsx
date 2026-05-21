'use client';

import { useMemo, useRef, useState, type PointerEvent } from 'react';
import {
    type OptionsChain,
    type OptionsExpirationMetrics,
    aggregateOpenInterest,
} from '@y0ngha/siglens-core';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { OpenInterestTooltip } from '@/components/options/utils/optionsTooltips';
import { findNearestStrikeIndex } from '@/domain/options/findNearestStrike';

interface OpenInterestChartProps {
    /** Spot price used to anchor the current-price guide line. */
    underlyingPrice: number;
    /** Chain matching the parent's selected expiration; null when absent. */
    chain: OptionsChain | null;
    /** Pre-computed metrics — `maxPain` drives the dashed guide line. */
    metrics: OptionsExpirationMetrics | null;
}

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

function slotWidth(count: number): number {
    return CHART_WIDTH / count;
}

function barCenterX(index: number, count: number): number {
    const sw = slotWidth(count);
    return PAD_LEFT + sw * index + sw / 2;
}

/**
 * Decide which strike indices show an x-axis label.
 *
 * 균등 stride로 thin 처리하되, 시각적 기준점인 양 끝·현재가·Max Pain
 * 인덱스는 무조건 포함한다. stride 계산이 ceil 기반이라 stride 자체로
 * 대략 `MAX_X_AXIS_LABELS` 개수가 잡히지만, anchors(현재가·Max Pain·
 * 마지막 인덱스)가 stride 위치와 겹치지 않으면 최종 개수는 이보다
 * 1~3개 정도 더 많아질 수 있다.
 */
function pickLabelIndices(
    count: number,
    anchors: ReadonlyArray<number>
): Set<number> {
    if (count <= MAX_X_AXIS_LABELS) {
        return new Set(Array.from({ length: count }, (_, i) => i));
    }
    const stride = Math.ceil(count / MAX_X_AXIS_LABELS);
    const strideIndices = Array.from(
        { length: Math.ceil(count / stride) },
        (_, k) => k * stride
    );
    const validAnchors = anchors.filter(a => a >= 0 && a < count);
    return new Set([...strideIndices, count - 1, ...validAnchors]);
}

function barPixelHeight(oi: number, maxOi: number): number {
    if (maxOi === 0) return 0;
    return Math.min((oi / maxOi) * HALF_HEIGHT, HALF_HEIGHT);
}

function fmtOi(value: number): string {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
    return String(value);
}

export function OpenInterestChart({
    underlyingPrice,
    chain,
    metrics,
}: OpenInterestChartProps) {
    const derived = useMemo(() => {
        if (!chain) return null;
        const oiByStrike = aggregateOpenInterest(chain);
        if (oiByStrike.length === 0) return null;

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

        return {
            oiByStrike,
            topOiSet,
            globalMax,
            maxPainIdx,
            currentPriceIdx,
        };
    }, [chain, metrics, underlyingPrice]);

    const containerRef = useRef<HTMLDivElement | null>(null);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [tooltipPos, setTooltipPos] = useState<{
        x: number;
        y: number;
    } | null>(null);

    if (!derived) {
        return (
            <p className="text-secondary-500 py-4 text-sm">
                이 만기에는 OI 데이터가 없어요.
            </p>
        );
    }

    const { oiByStrike, topOiSet, globalMax, maxPainIdx, currentPriceIdx } =
        derived;
    const count = oiByStrike.length;
    const sw = slotWidth(count);
    const bw = sw * BAR_WIDTH_FILL_RATIO;

    const handlePointerMove = (
        event: PointerEvent<SVGRectElement>,
        index: number
    ): void => {
        const container = containerRef.current;
        if (!container) return;
        const containerRect = container.getBoundingClientRect();
        setHoveredIndex(index);
        // container 기준 상대 좌표로 변환 — wrapper에 `position: relative`가
        // 걸려 있고 tooltip은 absolute로 띄우므로, viewport 좌표를 빼서 정렬.
        setTooltipPos({
            x: event.clientX - containerRect.left,
            y: event.clientY - containerRect.top,
        });
    };

    const handlePointerLeave = (): void => {
        setHoveredIndex(null);
        setTooltipPos(null);
    };

    const hoveredRow = hoveredIndex !== null ? oiByStrike[hoveredIndex] : null;

    const maxPainX = maxPainIdx >= 0 ? barCenterX(maxPainIdx, count) : null;
    const currentPriceX =
        currentPriceIdx >= 0 ? barCenterX(currentPriceIdx, count) : null;

    const labelIndices = pickLabelIndices(count, [maxPainIdx, currentPriceIdx]);
    const rotateLabels = labelIndices.size > LABEL_ROTATION_THRESHOLD;
    const peakOiLabel = fmtOi(globalMax);

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
                    strokeWidth={1}
                />

                <text
                    x={PAD_LEFT}
                    y={PAD_TOP - 4}
                    fill={COLOR_LABEL}
                    fontSize={9}
                    textAnchor="start"
                >
                    {peakOiLabel}
                </text>

                <text
                    x={PAD_LEFT}
                    y={MIDLINE_Y - 6}
                    fill={COLOR_CALL}
                    fontSize={9}
                    textAnchor="start"
                >
                    ▲ Call OI
                </text>

                <text
                    x={PAD_LEFT}
                    y={MIDLINE_Y + 14}
                    fill={COLOR_PUT}
                    fontSize={9}
                    textAnchor="start"
                >
                    ▼ Put OI
                </text>

                {oiByStrike.map((row, i) => {
                    const cx = barCenterX(i, count);
                    const isTopOi = topOiSet.has(row.strike);
                    const opacity = isTopOi
                        ? BAR_OPACITY_TOP_OI
                        : BAR_OPACITY_DEFAULT;
                    const callH = barPixelHeight(
                        row.callOpenInterest,
                        globalMax
                    );
                    const putH = barPixelHeight(row.putOpenInterest, globalMax);

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
                                onPointerEnter={e => handlePointerMove(e, i)}
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
                        strokeWidth={1.5}
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
                        strokeWidth={1.5}
                    />
                )}

                {oiByStrike.map((row, i) => {
                    if (!labelIndices.has(i)) return null;
                    const cx = barCenterX(i, count);
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

            {hoveredRow !== null && tooltipPos !== null && (
                <div
                    role="tooltip"
                    className="border-secondary-600 bg-secondary-900/95 text-secondary-100 pointer-events-none absolute z-10 min-w-[180px] -translate-x-1/2 -translate-y-full rounded-md border px-3 py-2 text-xs shadow-lg backdrop-blur"
                    style={{
                        left: tooltipPos.x,
                        top: tooltipPos.y - 8,
                    }}
                >
                    <div className="text-secondary-300 mb-1 font-semibold tabular-nums">
                        Strike ${hoveredRow.strike.toLocaleString()}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-chart-bullish">Call OI</span>
                        <span className="tabular-nums">
                            {hoveredRow.callOpenInterest.toLocaleString()} 계약
                        </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-chart-bearish">Put OI</span>
                        <span className="tabular-nums">
                            {hoveredRow.putOpenInterest.toLocaleString()} 계약
                        </span>
                    </div>
                    <div className="border-secondary-700 mt-1 flex items-center justify-between gap-3 border-t pt-1">
                        <span className="text-secondary-400">합계</span>
                        <span className="tabular-nums font-semibold">
                            {(
                                hoveredRow.callOpenInterest +
                                hoveredRow.putOpenInterest
                            ).toLocaleString()}{' '}
                            계약
                        </span>
                    </div>
                </div>
            )}

            <div className="text-secondary-500 mt-2 flex flex-wrap items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1">
                    <span
                        className="bg-chart-bullish inline-block h-2.5 w-2.5 rounded-sm"
                        aria-hidden="true"
                    />
                    Call OI
                </span>
                <span className="flex items-center gap-1">
                    <span
                        className="bg-chart-bearish inline-block h-2.5 w-2.5 rounded-sm"
                        aria-hidden="true"
                    />
                    Put OI
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

            <table className="sr-only">
                <caption>Strike별 Open Interest 데이터</caption>
                <thead>
                    <tr>
                        <th scope="col">Strike</th>
                        <th scope="col">Call OI</th>
                        <th scope="col">Put OI</th>
                    </tr>
                </thead>
                <tbody>
                    {oiByStrike.map(row => (
                        <tr key={row.strike}>
                            <td>{row.strike}</td>
                            <td>{row.callOpenInterest}</td>
                            <td>{row.putOpenInterest}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
