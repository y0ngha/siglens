'use client';

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
import { findNearestStrikeIndex } from '@/entities/options-chain';
import { useStrikeBarChart } from './hooks/useStrikeBarChart';
import {
    barCenterX,
    barPixelHeight,
    slotWidth,
} from './lib/strikeChartGeometry';
import { StrikeBarTooltip } from './ui/StrikeBarTooltip';
import { StrikeBarSrTable } from './ui/StrikeBarSrTable';

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

export function StrikeVolumeChart({
    underlyingPrice,
    chain,
}: StrikeVolumeChartProps) {
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
            </StrikeBarTooltip>

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

            <StrikeBarSrTable
                caption="Strike별 거래량 데이터"
                headers={['Strike', 'Call Volume', 'Put Volume']}
                rows={volumeByStrike.map(row => ({
                    key: row.strike,
                    cells: [row.strike, row.callVolume, row.putVolume],
                }))}
            />
        </div>
    );
}
