import { cn } from '@/shared/lib/cn';

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
}

const COLOR_CLASSES: Record<SeriesColor, SeriesColorClasses> = {
    bullish: {
        fill: 'fill-chart-bullish/70',
        stroke: 'stroke-chart-bullish',
        legend: 'bg-chart-bullish',
    },
    bearish: {
        fill: 'fill-chart-bearish/70',
        stroke: 'stroke-chart-bearish',
        legend: 'bg-chart-bearish',
    },
    neutral: {
        fill: 'fill-primary-500/70',
        stroke: 'stroke-primary-500',
        legend: 'bg-primary-500',
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

    const allValues: number[] = series.flatMap(s =>
        s.values.filter((v): v is number => v !== null)
    );

    const maxAbs =
        allValues.length > 0 ? Math.max(...allValues.map(Math.abs)) : 1;
    const hasNegative = allValues.some(v => v < 0);

    const barGroupWidth = (100 - (SVG_PADDING_LEFT + SVG_PADDING_RIGHT)) / n;
    const barPadding = barGroupWidth * 0.1;
    const singleBarWidth = (barGroupWidth - barPadding * 2) / seriesCount;

    // 음수 값이 있으면 baseline을 중앙에 둬 양/음 막대가 위아래로 갈라지게 한다.
    const baselineY = hasNegative
        ? SVG_PADDING_TOP + CHART_HEIGHT / 2
        : SVG_PADDING_TOP + CHART_HEIGHT;

    const availableHeight = hasNegative ? CHART_HEIGHT / 2 : CHART_HEIGHT;

    return (
        <div className="w-full">
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
                                className={colors.fill}
                            />
                        );
                    })
                )}
            </svg>

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
