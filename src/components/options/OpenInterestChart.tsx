'use client';

import {
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type PointerEvent,
} from 'react';
import {
    type OptionsChain,
    type OptionsExpirationMetrics,
    aggregateOpenInterest,
} from '@y0ngha/siglens-core';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import {
    CallOpenInterestTooltip,
    OpenInterestTooltip,
    PutOpenInterestTooltip,
} from '@/components/options/utils/optionsTooltips';
import {
    computeTooltipPos,
    TOOLTIP_ELEMENT_ID,
    TOOLTIP_MIN_WIDTH_PX,
    type TooltipPosition,
} from '@/components/options/utils/computeTooltipPos';
import { pickLabelIndices } from '@/components/options/utils/pickLabelIndices';
import { formatCompactCount } from '@/components/options/utils/formatCompactCount';
import {
    PEAK_LABEL_TOP_OFFSET_PX,
    CALL_LABEL_MIDLINE_OFFSET_PX,
    PUT_LABEL_MIDLINE_OFFSET_PX,
} from '@/components/options/utils/chartLabelOffsets';
import {
    MIDLINE_STROKE_WIDTH,
    GUIDE_LINE_STROKE_WIDTH,
} from '@/components/options/utils/chartStrokeWidths';
import { findNearestStrikeIndex } from '@/domain/options/findNearestStrike';
import {
    ET_MARKET_HOURS_DISPLAY,
    KST_EDT_HOURS_DISPLAY,
    KST_EST_HOURS_DISPLAY,
} from '@/components/options/utils/marketHoursDisplay';

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

function barPixelHeight(oi: number, maxOi: number): number {
    if (maxOi === 0) return 0;
    return Math.min((oi / maxOi) * HALF_HEIGHT, HALF_HEIGHT);
}

export function OpenInterestChart({
    underlyingPrice,
    chain,
    metrics,
}: OpenInterestChartProps) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [tooltipPos, setTooltipPos] = useState<TooltipPosition | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    // 컨테이너 DOMRect 캐시. pointerEnter 시 한 번 측정해 두고 pointerMove에서
    // 재사용한다 — move마다 `getBoundingClientRect`를 부르면 reflow를 매번
    // 트리거해 마우스가 빠르게 움직일 때 frame drop을 유발한다.
    const cachedRectRef = useRef<DOMRect | null>(null);

    const derived = useMemo(() => {
        if (!chain) return null;
        const oiByStrike = aggregateOpenInterest(chain);
        if (oiByStrike.length === 0) return null;

        // 모든 strike의 OI가 0이면 차트를 그려도 막대가 안 나오므로 빈
        // 메시지 분기로 떨어뜨려 사용자에게 정규장 시간 안내를 보여준다.
        const totalOi = oiByStrike.reduce(
            (sum, s) => sum + s.callOpenInterest + s.putOpenInterest,
            0
        );
        if (totalOi === 0) return null;

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
        return (
            <div className="border-secondary-700 bg-secondary-800 space-y-2 rounded-xl border p-4">
                <p className="text-secondary-300 text-sm font-medium">
                    이 만기에는 OI 데이터가 없어요.
                </p>
                <p className="text-secondary-500 text-xs leading-relaxed">
                    미국 정규장 마감 후에는 Yahoo가 Open Interest를 갱신하지
                    않아 비어 보일 수 있어요. 정확한 수치는 미국 정규장 시간(
                    {ET_MARKET_HOURS_DISPLAY}, 평일, 한국 시간 EDT 기간{' '}
                    {KST_EDT_HOURS_DISPLAY} / EST 기간 {KST_EST_HOURS_DISPLAY}
                    )에 다시 확인해 주세요.
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
    const sw = slotWidth(count);
    const bw = sw * BAR_WIDTH_FILL_RATIO;

    // hoveredIndex 가드: oiByStrike가 chip 전환으로 짧아지는 사이에 hover state
    // 가 stale이 되면 `oiByStrike[hoveredIndex]`가 undefined가 될 수 있다.
    // `??`로 정규화해 "배열 범위 초과 → null" 의도를 명시(`||`의 암묵적 falsy
    // 처리에 의존하지 않음 — row 객체는 항상 truthy라 의미 차이는 없지만
    // 표현이 더 정확하다).
    const hoveredRow =
        hoveredIndex !== null ? (oiByStrike[hoveredIndex] ?? null) : null;

    const maxPainX = maxPainIdx >= 0 ? barCenterX(maxPainIdx, count) : null;
    const currentPriceX =
        currentPriceIdx >= 0 ? barCenterX(currentPriceIdx, count) : null;

    const rotateLabels = labelIndices.size > LABEL_ROTATION_THRESHOLD;
    const peakOiLabel = formatCompactCount(globalMax);

    const handlePointerEnter = (
        event: PointerEvent<SVGRectElement>,
        index: number
    ): void => {
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        cachedRectRef.current = rect;
        setHoveredIndex(index);
        setTooltipPos(computeTooltipPos(event, rect));
    };

    const handlePointerMove = (
        event: PointerEvent<SVGRectElement>,
        index: number
    ): void => {
        const rect = cachedRectRef.current;
        // enter 핸들러가 캐시를 채우기 전에 move가 발사되는 경로(예: 모바일
        // touchmove)에서는 한 번 측정해 즉시 캐시한다 — 이후 move부터는
        // 캐시된 rect만 사용해 reflow 비용 없음.
        if (rect === null) {
            const container = containerRef.current;
            if (!container) return;
            const measured = container.getBoundingClientRect();
            cachedRectRef.current = measured;
            setHoveredIndex(index);
            setTooltipPos(computeTooltipPos(event, measured));
            return;
        }
        if (hoveredIndex !== index) setHoveredIndex(index);
        setTooltipPos(computeTooltipPos(event, rect));
    };

    const handlePointerLeave = (): void => {
        cachedRectRef.current = null;
        setHoveredIndex(null);
        setTooltipPos(null);
    };

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

            {/* `aria-describedby`가 가리키는 대상은 항상 DOM에 있어야 한다.
                `hidden` 속성으로 숨기면 접근성 트리에서도 제거되어 screen
                reader가 참조를 따라올 수 없지만, 하단 `sr-only` 테이블이
                전체 OI 데이터를 제공하므로 이 pointer-only tooltip에서는
                허용 가능한 트레이드오프다. */}
            <div
                id={TOOLTIP_ELEMENT_ID}
                role="tooltip"
                hidden={hoveredRow === null || tooltipPos === null}
                className="border-secondary-600 bg-secondary-900/95 text-secondary-100 pointer-events-none absolute top-[var(--tooltip-y)] left-[var(--tooltip-x)] z-10 min-w-[var(--tooltip-min-w)] -translate-x-1/2 -translate-y-full rounded-md border px-3 py-2 text-xs shadow-lg backdrop-blur"
                style={
                    // CSS 커스텀 프로퍼티(--*)는 런타임에 유효하나 React의
                    // CSSProperties 타입은 임의 `--*` 키를 포함하지 않아
                    // 인덱스 시그니처가 막힘 — TS 한계 우회용 cast이며
                    // 런타임 리스크는 없다.
                    {
                        '--tooltip-x': `${tooltipPos?.x ?? 0}px`,
                        '--tooltip-y': `${tooltipPos?.y ?? 0}px`,
                        '--tooltip-min-w': `${TOOLTIP_MIN_WIDTH_PX}px`,
                    } as CSSProperties
                }
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
            </div>

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
