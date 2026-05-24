'use client';

import {
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type PointerEvent,
} from 'react';
import type { OptionsChain } from '@y0ngha/siglens-core';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import {
    CallVolumeTooltip,
    PutVolumeTooltip,
} from '@/components/options/utils/optionsTooltips';
import {
    computeTooltipPos,
    TOOLTIP_MIN_WIDTH_PX,
    type TooltipPosition,
} from '@/components/options/utils/computeTooltipPos';
import { pickLabelIndices } from '@/components/options/utils/pickLabelIndices';
import { aggregateStrikeVolume } from '@/components/options/utils/aggregateStrikeVolume';
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

interface StrikeVolumeChartProps {
    /** Spot price used to anchor the current-price guide line. */
    underlyingPrice: number;
    /** Chain matching the parent's selected expiration; null when absent. */
    chain: OptionsChain | null;
}

// SVG 레이아웃 상수는 OpenInterestChart와 동일하게 복제한다 — 두 차트가
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

// Volume 전용 색상 토큰. OpenInterestChart와 같은 chart-bullish/bearish를
// 사용해 "Call 위 / Put 아래" 시각 언어를 통일한다.
const COLOR_CALL = 'var(--color-chart-bullish)';
const COLOR_PUT = 'var(--color-chart-bearish)';
const COLOR_GUIDE_LINE = 'var(--color-ui-warning)';
const COLOR_MIDLINE = 'var(--color-secondary-600)';
const COLOR_LABEL = 'var(--color-secondary-500)';

const BAR_OPACITY = 0.85;

// 모든 strike의 volume이 0일 때 globalMax가 0이 되어 barPixelHeight에서
// 0으로 나누는 경로를 막기 위한 하한값. OpenInterestChart와 동일 패턴.
const MIN_VOLUME_SCALE_FLOOR = 1;

// 슬롯 너비 대비 막대 두께 비율 — OpenInterestChart와 통일.
const BAR_WIDTH_FILL_RATIO = 0.7;

const MAX_X_AXIS_LABELS = 10;
const LABEL_ROTATION_THRESHOLD = 7;
const X_AXIS_LABEL_OFFSET_PX = 14;
const ROTATED_LABEL_FONT_SIZE = 8;
const STRAIGHT_LABEL_FONT_SIZE = 9;

// OpenInterestChart의 `oi-chart-tooltip`과 충돌하지 않도록 자체 id 사용.
// 두 차트가 같은 페이지에 동시에 렌더되므로 id가 겹치면 `aria-describedby`
// anchor가 어느 tooltip을 가리키는지 모호해진다.
const TOOLTIP_ELEMENT_ID = 'volume-chart-tooltip';

function slotWidth(count: number): number {
    return CHART_WIDTH / count;
}

function barCenterX(index: number, count: number): number {
    const sw = slotWidth(count);
    return PAD_LEFT + sw * index + sw / 2;
}

function barPixelHeight(volume: number, maxVolume: number): number {
    if (maxVolume === 0) return 0;
    return Math.min((volume / maxVolume) * HALF_HEIGHT, HALF_HEIGHT);
}

export function StrikeVolumeChart({
    underlyingPrice,
    chain,
}: StrikeVolumeChartProps) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [tooltipPos, setTooltipPos] = useState<TooltipPosition | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    // 컨테이너 DOMRect 캐시 — OpenInterestChart와 동일한 reflow 회피 패턴.
    const cachedRectRef = useRef<DOMRect | null>(null);

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
            <div className="border-secondary-700 bg-secondary-800 space-y-2 rounded-xl border p-4">
                <span className="text-secondary-300 text-sm font-medium">
                    Volume 분포 (Strike별)
                </span>
                <p className="text-secondary-500 text-xs leading-relaxed">
                    이 만기에는 거래량 데이터가 없어요.
                </p>
            </div>
        );
    }

    const { volumeByStrike, globalMax, currentPriceIdx, labelIndices } =
        derived;
    const count = volumeByStrike.length;
    const sw = slotWidth(count);
    const bw = sw * BAR_WIDTH_FILL_RATIO;

    // hoveredIndex 가드 — 만기 chip 전환으로 배열이 짧아지는 사이 stale
    // index가 남아있어도 안전하게 null 처리한다.
    const hoveredRow =
        hoveredIndex !== null ? (volumeByStrike[hoveredIndex] ?? null) : null;

    const currentPriceX =
        currentPriceIdx >= 0 ? barCenterX(currentPriceIdx, count) : null;

    const rotateLabels = labelIndices.size > LABEL_ROTATION_THRESHOLD;
    const peakVolumeLabel = formatCompactCount(globalMax);

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
        // enter 전에 move가 먼저 발사되는 모바일 touchmove 경로 대응 —
        // 한 번 측정해 캐시한 뒤 이후 move부터는 캐시만 읽는다.
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
            <span className="text-secondary-300 text-sm font-medium">
                Volume 분포 (Strike별)
            </span>

            <svg
                viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                role="img"
                aria-labelledby="volume-chart-title volume-chart-desc"
                className="block w-full"
            >
                <title id="volume-chart-title">Strike별 거래량 분포</title>
                <desc id="volume-chart-desc">
                    Call과 Put의 오늘 거래량을 strike 가격대별로 막대그래프로
                    표시합니다. 현재 주가는 세로선으로 강조됩니다.
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
                    fill={COLOR_CALL}
                    fontSize={STRAIGHT_LABEL_FONT_SIZE}
                    textAnchor="start"
                >
                    ▲ Call Vol
                </text>

                <text
                    x={PAD_LEFT}
                    y={MIDLINE_Y + PUT_LABEL_MIDLINE_OFFSET_PX}
                    fill={COLOR_PUT}
                    fontSize={STRAIGHT_LABEL_FONT_SIZE}
                    textAnchor="start"
                >
                    ▼ Put Vol
                </text>

                {volumeByStrike.map((row, i) => {
                    const cx = barCenterX(i, count);
                    const callH = barPixelHeight(row.callVolume, globalMax);
                    const putH = barPixelHeight(row.putVolume, globalMax);

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
                `hidden`으로 숨기면 접근성 트리에서도 빠지지만, 하단 sr-only
                테이블이 전체 volume 데이터를 제공하므로 이 pointer-only
                tooltip에서는 허용 가능한 트레이드오프다. */}
            <div
                id={TOOLTIP_ELEMENT_ID}
                role="tooltip"
                hidden={hoveredRow === null || tooltipPos === null}
                className="border-secondary-600 bg-secondary-900/95 text-secondary-100 pointer-events-none absolute top-[var(--tooltip-y)] left-[var(--tooltip-x)] z-10 min-w-[var(--tooltip-min-w)] -translate-x-1/2 -translate-y-full rounded-md border px-3 py-2 text-xs shadow-lg backdrop-blur"
                style={
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
                            <span className="text-chart-bullish">Call Vol</span>
                            <span className="tabular-nums">
                                {hoveredRow.callVolume.toLocaleString()} 계약
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-chart-bearish">Put Vol</span>
                            <span className="tabular-nums">
                                {hoveredRow.putVolume.toLocaleString()} 계약
                            </span>
                        </div>
                        <div className="border-secondary-700 mt-1 flex items-center justify-between gap-3 border-t pt-1">
                            <span className="text-secondary-400">합계</span>
                            <span className="font-semibold tabular-nums">
                                {(
                                    hoveredRow.callVolume + hoveredRow.putVolume
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
                    Call Vol
                    <InfoTooltip>{CallVolumeTooltip}</InfoTooltip>
                </span>
                <span className="flex items-center gap-1">
                    <span
                        className="bg-chart-bearish inline-block h-2.5 w-2.5 rounded-sm"
                        aria-hidden="true"
                    />
                    Put Vol
                    <InfoTooltip>{PutVolumeTooltip}</InfoTooltip>
                </span>
                <span className="flex items-center gap-1">
                    <span
                        className="border-ui-warning inline-block w-[14px] border-t-[1.5px] border-solid"
                        aria-hidden="true"
                    />
                    현재가
                </span>
            </div>

            {/* OpenInterestChart와 동일 — <table>에 sr-only를 직접 두면
                `display: table`이 normal flow에 잔재를 남겨 페이지 height에
                영향을 주므로 <div>로 감싼다. */}
            <div className="sr-only">
                <table>
                    <caption>Strike별 거래량 데이터</caption>
                    <thead>
                        <tr>
                            <th scope="col">Strike</th>
                            <th scope="col">Call Volume</th>
                            <th scope="col">Put Volume</th>
                        </tr>
                    </thead>
                    <tbody>
                        {volumeByStrike.map(row => (
                            <tr key={row.strike}>
                                <td>{row.strike}</td>
                                <td>{row.callVolume}</td>
                                <td>{row.putVolume}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
