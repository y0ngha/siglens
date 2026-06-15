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
const SVG_PADDING_BOTTOM = 32; // room for x-axis labels
const SVG_PADDING_LEFT = 4;
const SVG_PADDING_RIGHT = 4;
const CHART_HEIGHT = SVG_HEIGHT - SVG_PADDING_TOP - SVG_PADDING_BOTTOM;

const COLOR_CLASSES: Record<SeriesColor, { fill: string; stroke: string }> = {
    bullish: {
        fill: 'fill-chart-bullish/70',
        stroke: 'stroke-chart-bullish',
    },
    bearish: {
        fill: 'fill-chart-bearish/70',
        stroke: 'stroke-chart-bearish',
    },
    neutral: {
        fill: 'fill-primary-500/70',
        stroke: 'stroke-primary-500',
    },
};

/**
 * Inline SVG bar chart for multi-series N-year financial trend data.
 * RSC-safe: no chart library, pure SVG.
 *
 * Negative values are colored bearish regardless of the series color prop.
 * Responsive: width="100%", height is fixed.
 * Decorative: aria-hidden="true" so screen readers skip the visual.
 */
export function FinancialTrendChart({
    series,
    periods,
}: FinancialTrendChartProps) {
    const n = periods.length;
    const seriesCount = series.length;

    // Collect all non-null values to determine scale
    const allValues: number[] = series.flatMap(s =>
        s.values.filter((v): v is number => v !== null)
    );

    const maxAbs =
        allValues.length > 0 ? Math.max(...allValues.map(Math.abs)) : 1;
    const hasNegative = allValues.some(v => v < 0);

    // Chart area geometry (in SVG viewBox units, using percentages for x)
    const barGroupWidth = (100 - (SVG_PADDING_LEFT + SVG_PADDING_RIGHT)) / n;
    const barPadding = barGroupWidth * 0.1;
    const singleBarWidth = (barGroupWidth - barPadding * 2) / seriesCount;

    // Y baseline: if all positive → baseline at bottom; if mixed → baseline at midpoint
    const baselineY = hasNegative
        ? SVG_PADDING_TOP + CHART_HEIGHT / 2
        : SVG_PADDING_TOP + CHART_HEIGHT;

    const availableHeight = hasNegative ? CHART_HEIGHT / 2 : CHART_HEIGHT;

    function barHeight(value: number): number {
        if (maxAbs === 0) return 0;
        return (Math.abs(value) / maxAbs) * availableHeight;
    }

    function barX(periodIdx: number, seriesIdx: number): string {
        const groupStart =
            SVG_PADDING_LEFT + periodIdx * barGroupWidth + barPadding;
        return `${groupStart + seriesIdx * singleBarWidth}%`;
    }

    function barY(value: number): number {
        const h = barHeight(value);
        return value >= 0 ? baselineY - h : baselineY;
    }

    function resolveColor(
        seriesIdx: number,
        value: number | null
    ): { fill: string; stroke: string } {
        if (value !== null && value < 0) return COLOR_CLASSES.bearish;
        const c = series[seriesIdx]?.color ?? 'neutral';
        return COLOR_CLASSES[c];
    }

    return (
        <div className="w-full">
            {/* Legend */}
            {seriesCount > 1 && (
                <div className="mb-2 flex flex-wrap gap-3">
                    {series.map((s, i) => {
                        const c = s.color ?? 'neutral';
                        const colorClass =
                            c === 'bullish'
                                ? 'bg-chart-bullish'
                                : c === 'bearish'
                                  ? 'bg-chart-bearish'
                                  : 'bg-primary-500';
                        return (
                            <div key={i} className="flex items-center gap-1">
                                <span
                                    className={`inline-block h-2 w-2 rounded-full ${colorClass}`}
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
                {/* Baseline */}
                <line
                    x1={`${SVG_PADDING_LEFT}%`}
                    y1={baselineY}
                    x2={`${100 - SVG_PADDING_RIGHT}%`}
                    y2={baselineY}
                    className="stroke-secondary-700"
                    strokeWidth="0.5"
                />

                {/* Bars */}
                {series.map((s, si) =>
                    s.values.map((v, pi) => {
                        if (v === null) return null;
                        const colors = resolveColor(si, v);
                        const h = barHeight(v);
                        if (h === 0) return null;

                        return (
                            <rect
                                key={`${si}-${pi}`}
                                x={barX(pi, si)}
                                y={barY(v)}
                                width={`${singleBarWidth}%`}
                                height={h}
                                rx="1"
                                className={colors.fill}
                            />
                        );
                    })
                )}

                {/* X-axis period labels */}
                {periods.map((p, pi) => {
                    const groupCenter =
                        SVG_PADDING_LEFT +
                        pi * barGroupWidth +
                        barGroupWidth / 2;
                    return (
                        <text
                            key={p}
                            x={`${groupCenter}%`}
                            y={SVG_HEIGHT - 6}
                            textAnchor="middle"
                            className="fill-secondary-500 text-[6px]"
                            fontSize="6"
                        >
                            {p}
                        </text>
                    );
                })}
            </svg>

            {/* Accessible period labels below (visible text mirrors SVG text) */}
            <div className="mt-1 flex justify-between">
                {periods.map(p => (
                    <span key={p} className="text-secondary-500 text-xs">
                        {p}
                    </span>
                ))}
            </div>
        </div>
    );
}
