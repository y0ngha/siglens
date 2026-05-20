'use client';

import { useMemo } from 'react';
import {
    type OptionsSnapshot,
    aggregateOpenInterest,
    summarizeChainForLlm,
} from '@y0ngha/siglens-core';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { findNearestStrikeIndex } from '@/domain/options/findNearestStrike';
import { pickActiveChain } from '@/domain/options/pickActiveChain';

interface OpenInterestChartProps {
    expirationDate: string | 'all';
    snapshot: OptionsSnapshot;
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
const BAR_OPACITY_TOP3 = 1;

function barCenterX(index: number, count: number): number {
    const slotWidth = CHART_WIDTH / count;
    return PAD_LEFT + slotWidth * index + slotWidth / 2;
}

function barWidth(count: number): number {
    return (CHART_WIDTH / count) * 0.7;
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
    expirationDate,
    snapshot,
}: OpenInterestChartProps) {
    const underlyingPrice = snapshot.underlyingPrice;

    const derived = useMemo(() => {
        const selectedChain = pickActiveChain(snapshot, expirationDate);
        if (!selectedChain) return null;
        const oiByStrike = aggregateOpenInterest(selectedChain);
        if (oiByStrike.length === 0) return null;

        const maxPain = summarizeChainForLlm(
            selectedChain,
            underlyingPrice
        ).maxPain;

        const top3Set = new Set<number>(
            oiByStrike
                .toSorted(
                    (a, b) =>
                        b.callOpenInterest +
                        b.putOpenInterest -
                        (a.callOpenInterest + a.putOpenInterest)
                )
                .slice(0, 3)
                .map(x => x.strike)
        );

        const globalMax = Math.max(
            Math.max(...oiByStrike.map(s => s.callOpenInterest), 1),
            Math.max(...oiByStrike.map(s => s.putOpenInterest), 1)
        );

        const strikes = oiByStrike.map(s => s.strike);
        const maxPainIdx = Number.isNaN(maxPain)
            ? -1
            : findNearestStrikeIndex(strikes, maxPain);
        const currentPriceIdx = findNearestStrikeIndex(
            strikes,
            underlyingPrice
        );

        return {
            oiByStrike,
            top3Set,
            globalMax,
            maxPainIdx,
            currentPriceIdx,
        };
    }, [snapshot, expirationDate, underlyingPrice]);

    if (!derived) {
        return (
            <p className="text-secondary-500 py-4 text-sm">
                이 만기에는 OI 데이터가 없어요.
            </p>
        );
    }

    const { oiByStrike, top3Set, globalMax, maxPainIdx, currentPriceIdx } =
        derived;
    const count = oiByStrike.length;
    const bw = barWidth(count);

    const maxPainX = maxPainIdx >= 0 ? barCenterX(maxPainIdx, count) : null;
    const currentPriceX =
        currentPriceIdx >= 0 ? barCenterX(currentPriceIdx, count) : null;

    const rotateLabels = count > 14;
    const peakOiLabel = fmtOi(globalMax);

    return (
        <div className="border-secondary-700 bg-secondary-800 space-y-2 rounded-xl border p-4">
            <div className="flex items-center gap-1">
                <span className="text-secondary-300 text-sm font-medium">
                    Open Interest 분포 (Strike별)
                </span>
                <InfoTooltip>
                    <p>
                        특정 옵션에 현재 살아있는(아직 청산 안 된) 계약 수예요.
                    </p>
                    <p>
                        한쪽 가격대에 OI가 두텁다는 건 그 가격에 많은 사람이
                        베팅했다는 뜻이에요.
                    </p>
                </InfoTooltip>
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
                    const isTop3 = top3Set.has(row.strike);
                    const opacity = isTop3
                        ? BAR_OPACITY_TOP3
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
