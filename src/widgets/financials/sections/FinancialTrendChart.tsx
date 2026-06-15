'use client';

import { useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { usdFormatter } from '../utils/numberFormat';

type SeriesColor = 'bullish' | 'bearish' | 'neutral';

interface TrendSeries {
    labelKo: string;
    /**
     * Values aligned to the `periods` array. Oldest→newest (left-to-right).
     * Null means no data for that period.
     */
    values: (number | null)[];
    color?: SeriesColor;
}

interface FinancialTrendChartProps {
    series: TrendSeries[];
    /**
     * Period labels — oldest first (left-to-right display order).
     */
    periods: string[];
}

const SVG_HEIGHT = 120;
const SVG_PADDING_TOP = 8;
const SVG_PADDING_BOTTOM = 8;
const SVG_PADDING_LEFT = 4;
const SVG_PADDING_RIGHT = 4;
const CHART_HEIGHT = SVG_HEIGHT - SVG_PADDING_TOP - SVG_PADDING_BOTTOM;

interface SeriesColorClasses {
    fill: string;
    stroke: string;
    legend: string;
    dot: string;
}

const COLOR_CLASSES: Record<SeriesColor, SeriesColorClasses> = {
    bullish: {
        fill: 'fill-chart-bullish/70',
        stroke: 'stroke-chart-bullish',
        legend: 'bg-chart-bullish',
        dot: 'bg-chart-bullish',
    },
    bearish: {
        fill: 'fill-chart-bearish/70',
        stroke: 'stroke-chart-bearish',
        legend: 'bg-chart-bearish',
        dot: 'bg-chart-bearish',
    },
    neutral: {
        fill: 'fill-primary-500/70',
        stroke: 'stroke-primary-500',
        legend: 'bg-primary-500',
        dot: 'bg-primary-500',
    },
};

function barHeight(
    value: number,
    maxAbs: number,
    availableHeight: number
): number {
    if (maxAbs === 0) return 0;
    return (Math.abs(value) / maxAbs) * availableHeight;
}

function barX(
    periodIdx: number,
    seriesIdx: number,
    barGroupWidth: number,
    barPadding: number,
    singleBarWidth: number
): string {
    const groupStart =
        SVG_PADDING_LEFT + periodIdx * barGroupWidth + barPadding;
    return `${groupStart + seriesIdx * singleBarWidth}%`;
}

function barY(value: number, height: number, baselineY: number): number {
    return value >= 0 ? baselineY - height : baselineY;
}

function resolveColor(
    series: TrendSeries[],
    seriesIdx: number,
    value: number | null
): SeriesColorClasses {
    if (value !== null && value < 0) return COLOR_CLASSES.bearish;
    const c = series[seriesIdx]?.color ?? 'neutral';
    return COLOR_CLASSES[c];
}

/** Compact USD for the hover readout; null → em-dash. */
function fmt(value: number | null): string {
    return value === null ? '—' : usdFormatter.format(value);
}

interface HoverState {
    periodIdx: number;
    x: number;
    y: number;
}

/**
 * Inline SVG bar chart for multi-series N-year financial trend data.
 * No chart library — pure SVG. SSR-rendered bars stay crawlable; the hover
 * readout (mouse-only progressive enhancement — the StatementTable below is the
 * accessible value source) shows each series' value for the hovered period,
 * mirroring the options page charts.
 *
 * Negative values are colored bearish regardless of the series color prop.
 * Responsive: width="100%", height is fixed.
 */
export function FinancialTrendChart({
    series,
    periods,
}: FinancialTrendChartProps) {
    const [hover, setHover] = useState<HoverState | null>(null);

    const n = periods.length;
    const seriesCount = series.length;
    if (n === 0 || seriesCount === 0) return null;

    const allValues: number[] = series.flatMap(s =>
        s.values.filter((v): v is number => v !== null)
    );

    // reduce keeps this O(n) and stack-safe regardless of array size
    // (Math.max(...spread) overflows the call stack on very large inputs).
    const maxAbs = allValues.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
    const hasNegative = allValues.some(v => v < 0);

    const barGroupWidth = (100 - (SVG_PADDING_LEFT + SVG_PADDING_RIGHT)) / n;
    const barPadding = barGroupWidth * 0.1;
    const singleBarWidth = (barGroupWidth - barPadding * 2) / seriesCount;

    const baselineY = hasNegative
        ? SVG_PADDING_TOP + CHART_HEIGHT / 2
        : SVG_PADDING_TOP + CHART_HEIGHT;

    const availableHeight = hasNegative ? CHART_HEIGHT / 2 : CHART_HEIGHT;

    return (
        <div className="relative w-full">
            {seriesCount > 1 && (
                <div className="mb-2 flex flex-wrap gap-3">
                    {series.map(s => {
                        const c = s.color ?? 'neutral';
                        return (
                            <div
                                key={s.labelKo}
                                className="flex items-center gap-1"
                            >
                                <span
                                    className={cn(
                                        'inline-block h-2 w-2 rounded-full',
                                        COLOR_CLASSES[c].legend
                                    )}
                                />
                                <span className="text-secondary-400 text-xs">
                                    {s.labelKo}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
            {seriesCount === 1 && (
                <div className="mb-1">
                    <span className="text-secondary-400 text-xs">
                        {series[0].labelKo}
                    </span>
                </div>
            )}

            <svg
                width="100%"
                height={SVG_HEIGHT}
                aria-hidden="true"
                role="presentation"
                className="overflow-visible"
                viewBox={`0 0 100 ${SVG_HEIGHT}`}
                preserveAspectRatio="none"
            >
                <line
                    x1={`${SVG_PADDING_LEFT}%`}
                    y1={baselineY}
                    x2={`${100 - SVG_PADDING_RIGHT}%`}
                    y2={baselineY}
                    className="stroke-secondary-700"
                    strokeWidth="0.5"
                />

                {series.map((s, si) =>
                    s.values.map((v, pi) => {
                        if (v === null) return null;
                        const colors = resolveColor(series, si, v);
                        const h = barHeight(v, maxAbs, availableHeight);
                        if (h === 0) return null;

                        return (
                            <rect
                                key={`${si}-${pi}`}
                                x={barX(
                                    pi,
                                    si,
                                    barGroupWidth,
                                    barPadding,
                                    singleBarWidth
                                )}
                                y={barY(v, h, baselineY)}
                                width={`${singleBarWidth}%`}
                                height={h}
                                rx="1"
                                className={cn(
                                    colors.fill,
                                    hover !== null &&
                                        hover.periodIdx !== pi &&
                                        'opacity-40'
                                )}
                            />
                        );
                    })
                )}

                {/* Transparent full-height hover targets, one per period group. */}
                {periods.map((p, pi) => (
                    <rect
                        key={`hit-${p}`}
                        x={`${SVG_PADDING_LEFT + pi * barGroupWidth}%`}
                        y={SVG_PADDING_TOP}
                        width={`${barGroupWidth}%`}
                        height={CHART_HEIGHT}
                        fill="transparent"
                        className="cursor-crosshair"
                        onPointerEnter={e =>
                            setHover({
                                periodIdx: pi,
                                x: e.clientX,
                                y: e.clientY,
                            })
                        }
                        onPointerMove={e =>
                            setHover({
                                periodIdx: pi,
                                x: e.clientX,
                                y: e.clientY,
                            })
                        }
                        onPointerLeave={() => setHover(null)}
                    />
                ))}
            </svg>

            <div className="mt-1 flex justify-between">
                {periods.map(p => (
                    <span key={p} className="text-secondary-500 text-xs">
                        {p}
                    </span>
                ))}
            </div>

            {hover !== null && (
                <div
                    role="tooltip"
                    className="border-secondary-600 bg-secondary-900 pointer-events-none fixed z-50 rounded-md border px-3 py-2 text-xs shadow-lg"
                    style={{
                        left: hover.x + 12,
                        top: hover.y + 12,
                    }}
                >
                    <div className="text-secondary-300 mb-1 font-medium">
                        {periods[hover.periodIdx]}
                    </div>
                    <ul className="space-y-0.5">
                        {series.map(s => {
                            const c = s.color ?? 'neutral';
                            const v = s.values[hover.periodIdx] ?? null;
                            return (
                                <li
                                    key={s.labelKo}
                                    className="flex items-center justify-between gap-3"
                                >
                                    <span className="flex items-center gap-1">
                                        <span
                                            className={cn(
                                                'inline-block h-2 w-2 rounded-full',
                                                v !== null && v < 0
                                                    ? COLOR_CLASSES.bearish.dot
                                                    : COLOR_CLASSES[c].dot
                                            )}
                                        />
                                        <span className="text-secondary-400">
                                            {s.labelKo}
                                        </span>
                                    </span>
                                    <span className="font-mono tabular-nums">
                                        {fmt(v)}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
}
