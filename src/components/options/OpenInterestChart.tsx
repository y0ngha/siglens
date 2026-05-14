'use client';

import { InfoTooltip } from '@/components/ui/InfoTooltip';
import type { OptionsSnapshot, StrikeOpenInterest } from '@y0ngha/siglens-core';
import {
    aggregateOpenInterest,
    calculateMaxPain,
} from '@y0ngha/siglens-core';

interface OpenInterestChartProps {
    symbol: string;
    expirationDate: string | 'all';
    snapshot: OptionsSnapshot;
}

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const SVG_WIDTH = 600;
const SVG_HEIGHT = 240;
const PAD_TOP = 30;
const PAD_BOTTOM = 50; // room for strike labels
const PAD_LEFT = 12;
const PAD_RIGHT = 12;

const CHART_WIDTH = SVG_WIDTH - PAD_LEFT - PAD_RIGHT;
const CHART_HEIGHT = SVG_HEIGHT - PAD_TOP - PAD_BOTTOM;
const MIDLINE_Y = PAD_TOP + CHART_HEIGHT / 2;
const HALF_HEIGHT = CHART_HEIGHT / 2;

// Color tokens (exact RGB from spec)
const COLOR_CALL = 'rgb(16 185 129)'; // emerald-500
const COLOR_CALL_TOP3 = 'rgb(52 211 153)'; // emerald-400
const COLOR_PUT = 'rgb(239 68 68)'; // red-500
const COLOR_PUT_TOP3 = 'rgb(248 113 113)'; // red-400
const COLOR_MAX_PAIN = 'rgb(245 158 11)'; // amber-500
const COLOR_CURRENT = 'rgb(251 191 36)'; // amber-400
const COLOR_MIDLINE = 'rgb(71 85 105)'; // secondary-600
const COLOR_LABEL = 'rgb(100 116 139)'; // secondary-500

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the x-center pixel for a given column index. */
function barCenterX(index: number, count: number): number {
    const slotWidth = CHART_WIDTH / count;
    return PAD_LEFT + slotWidth * index + slotWidth / 2;
}

/** Bar width = 70% of slot. */
function barWidth(count: number): number {
    return (CHART_WIDTH / count) * 0.7;
}

/**
 * Pixel height for a bar given its OI value and the per-side max OI.
 * Clamped to HALF_HEIGHT.
 */
function barPixelHeight(oi: number, maxOi: number): number {
    if (maxOi === 0) return 0;
    return Math.min((oi / maxOi) * HALF_HEIGHT, HALF_HEIGHT);
}

/**
 * Find the strike index whose value is closest to a target price.
 * Returns -1 when the array is empty.
 */
function closestStrikeIndex(
    strikes: ReadonlyArray<StrikeOpenInterest>,
    target: number
): number {
    if (strikes.length === 0) return -1;
    let best = 0;
    let bestDist = Math.abs(strikes[0].strike - target);
    for (let i = 1; i < strikes.length; i++) {
        const d = Math.abs(strikes[i].strike - target);
        if (d < bestDist) {
            bestDist = d;
            best = i;
        }
    }
    return best;
}

/** Format OI in compact notation (e.g. 12500 → "12.5k"). */
function fmtOi(value: number): string {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
    return String(value);
}

// ---------------------------------------------------------------------------
// OpenInterestChart
// ---------------------------------------------------------------------------

export function OpenInterestChart({
    expirationDate,
    snapshot,
}: OpenInterestChartProps) {
    const chains = snapshot.chains;

    // ---- chain selection (same logic as OptionsMetricsRow) ----
    const nearestChain = chains[0] ?? null;
    const selectedChain =
        expirationDate === 'all'
            ? nearestChain
            : (chains.find(c => c.expirationDate === expirationDate) ??
              nearestChain);

    // ---- empty state ----
    if (!selectedChain) {
        return (
            <p className="text-secondary-500 text-sm py-4">
                이 만기에는 OI 데이터가 없어요.
            </p>
        );
    }

    const oiByStrike = aggregateOpenInterest(selectedChain);

    if (oiByStrike.length === 0) {
        return (
            <p className="text-secondary-500 text-sm py-4">
                이 만기에는 OI 데이터가 없어요.
            </p>
        );
    }

    const maxPain = calculateMaxPain(selectedChain);
    const underlyingPrice = snapshot.underlyingPrice;

    // ---- top-3 strikes (by combined OI) ----
    const top3Set = new Set<number>(
        [...oiByStrike]
            .sort(
                (a, b) =>
                    b.callOpenInterest +
                    b.putOpenInterest -
                    (a.callOpenInterest + a.putOpenInterest)
            )
            .slice(0, 3)
            .map(x => x.strike)
    );

    // ---- scale: per-side maximum ----
    const maxCallOi = Math.max(...oiByStrike.map(s => s.callOpenInterest), 1);
    const maxPutOi = Math.max(...oiByStrike.map(s => s.putOpenInterest), 1);
    const globalMax = Math.max(maxCallOi, maxPutOi);

    const count = oiByStrike.length;
    const bw = barWidth(count);

    // ---- vertical line x positions ----
    const maxPainIdx = isNaN(maxPain)
        ? -1
        : closestStrikeIndex(oiByStrike, maxPain);
    const currentPriceIdx = closestStrikeIndex(oiByStrike, underlyingPrice);

    const maxPainX =
        maxPainIdx >= 0 ? barCenterX(maxPainIdx, count) : null;
    const currentPriceX =
        currentPriceIdx >= 0 ? barCenterX(currentPriceIdx, count) : null;

    // ---- strike label density: rotate if more than 14 strikes ----
    const rotateLabelThreshold = 14;
    const rotateLabels = count > rotateLabelThreshold;

    // ---- Y-axis label: peak OI annotation ----
    const peakOiLabel = fmtOi(globalMax);

    return (
        <div className="border-secondary-700 bg-secondary-800 rounded-xl border p-4 space-y-2">
            {/* Header */}
            <div className="flex items-center gap-1">
                <span className="text-secondary-300 text-sm font-medium">
                    Open Interest 분포 (Strike별)
                </span>
                <InfoTooltip>
                    <p>특정 옵션에 현재 살아있는(아직 청산 안 된) 계약 수예요.</p>
                    <p>
                        한쪽 가격대에 OI가 두텁다는 건 그 가격에 많은 사람이 베팅했다는
                        뜻이에요.
                    </p>
                </InfoTooltip>
            </div>

            {/* SVG chart */}
            <svg
                viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                role="img"
                aria-labelledby="oi-chart-title oi-chart-desc"
                className="w-full"
                style={{ display: 'block' }}
            >
                <title id="oi-chart-title">Strike별 Open Interest 분포</title>
                <desc id="oi-chart-desc">
                    Call과 Put의 만기별 OI를 strike 가격대별로 막대그래프로 표시합니다.
                    Max Pain과 현재 주가는 세로선으로 강조됩니다.
                </desc>

                {/* Midline */}
                <line
                    x1={PAD_LEFT}
                    y1={MIDLINE_Y}
                    x2={SVG_WIDTH - PAD_RIGHT}
                    y2={MIDLINE_Y}
                    stroke={COLOR_MIDLINE}
                    strokeWidth={1}
                />

                {/* Peak OI label (top-left corner, secondary-500) */}
                <text
                    x={PAD_LEFT}
                    y={PAD_TOP - 4}
                    fill={COLOR_LABEL}
                    fontSize={9}
                    textAnchor="start"
                >
                    {peakOiLabel}
                </text>

                {/* Call OI label */}
                <text
                    x={PAD_LEFT}
                    y={MIDLINE_Y - 6}
                    fill={COLOR_CALL}
                    fontSize={9}
                    textAnchor="start"
                >
                    ▲ Call OI
                </text>

                {/* Put OI label */}
                <text
                    x={PAD_LEFT}
                    y={MIDLINE_Y + 14}
                    fill={COLOR_PUT}
                    fontSize={9}
                    textAnchor="start"
                >
                    ▼ Put OI
                </text>

                {/* Bars */}
                {oiByStrike.map((row, i) => {
                    const cx = barCenterX(i, count);
                    const isTop3 = top3Set.has(row.strike);

                    const callH = barPixelHeight(row.callOpenInterest, globalMax);
                    const putH = barPixelHeight(row.putOpenInterest, globalMax);

                    const callFill = isTop3 ? COLOR_CALL_TOP3 : COLOR_CALL;
                    const putFill = isTop3 ? COLOR_PUT_TOP3 : COLOR_PUT;

                    return (
                        <g key={row.strike}>
                            {/* Call bar — grows upward from midline */}
                            {row.callOpenInterest > 0 && (
                                <rect
                                    x={cx - bw / 2}
                                    y={MIDLINE_Y - callH}
                                    width={bw}
                                    height={callH}
                                    fill={callFill}
                                    opacity={0.9}
                                />
                            )}
                            {/* Put bar — grows downward from midline */}
                            {row.putOpenInterest > 0 && (
                                <rect
                                    x={cx - bw / 2}
                                    y={MIDLINE_Y}
                                    width={bw}
                                    height={putH}
                                    fill={putFill}
                                    opacity={0.9}
                                />
                            )}
                        </g>
                    );
                })}

                {/* Max Pain vertical line (dashed, amber-500) */}
                {maxPainX !== null && (
                    <line
                        x1={maxPainX}
                        y1={PAD_TOP}
                        x2={maxPainX}
                        y2={SVG_HEIGHT - PAD_BOTTOM}
                        stroke={COLOR_MAX_PAIN}
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                    />
                )}

                {/* Current price vertical line (solid, amber-400) */}
                {currentPriceX !== null && (
                    <line
                        x1={currentPriceX}
                        y1={PAD_TOP}
                        x2={currentPriceX}
                        y2={SVG_HEIGHT - PAD_BOTTOM}
                        stroke={COLOR_CURRENT}
                        strokeWidth={1.5}
                    />
                )}

                {/* Strike labels */}
                {oiByStrike.map((row, i) => {
                    const cx = barCenterX(i, count);
                    const labelY = SVG_HEIGHT - PAD_BOTTOM + 14;

                    if (rotateLabels) {
                        return (
                            <text
                                key={`lbl-${row.strike}`}
                                x={cx}
                                y={labelY}
                                fill={COLOR_LABEL}
                                fontSize={8}
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
                            fontSize={9}
                            textAnchor="middle"
                        >
                            {row.strike}
                        </text>
                    );
                })}
            </svg>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 text-[10px] text-secondary-500 mt-2">
                <span className="flex items-center gap-1">
                    <span
                        className="inline-block w-2.5 h-2.5 rounded-sm"
                        style={{ background: COLOR_CALL }}
                        aria-hidden="true"
                    />
                    Call OI
                </span>
                <span className="flex items-center gap-1">
                    <span
                        className="inline-block w-2.5 h-2.5 rounded-sm"
                        style={{ background: COLOR_PUT }}
                        aria-hidden="true"
                    />
                    Put OI
                </span>
                <span className="flex items-center gap-1">
                    <span
                        className="inline-block"
                        style={{ borderTop: `1.5px dashed ${COLOR_MAX_PAIN}`, width: '14px' }}
                        aria-hidden="true"
                    />
                    Max Pain
                </span>
                <span className="flex items-center gap-1">
                    <span
                        className="inline-block"
                        style={{ borderTop: `1.5px solid ${COLOR_CURRENT}`, width: '14px' }}
                        aria-hidden="true"
                    />
                    현재가
                </span>
            </div>

            {/* Accessible data table (screen-reader only) */}
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
