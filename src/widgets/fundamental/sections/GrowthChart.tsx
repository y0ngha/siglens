import type { FundamentalGrowthInput } from '@y0ngha/siglens-core';
import { EmptySectionCard } from './EmptySectionCard';
import { cn } from '@/shared/lib/cn';

const HEADING_ID = 'growth-heading';
const HEADING_CLASS_NAME = 'mb-2 text-lg font-semibold tracking-tight';

interface GrowthChartProps {
    growth: FundamentalGrowthInput | null;
}

interface GrowthBarProps {
    label: string;
    value: number | null;
    description: string;
}

/** Inline SVG bar for a single growth metric. Positive = green, negative = red; clamps at ±100%. */
function GrowthBar({ label, value, description }: GrowthBarProps) {
    const pct = value !== null ? value * 100 : null;
    const formattedPct =
        pct !== null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%` : '—';

    const fillAbs = pct !== null ? Math.min(100, Math.abs(pct)) : 0;
    const isPositive = pct !== null ? pct >= 0 : true;

    return (
        <div className="py-3">
            <div className="mb-2 flex items-baseline justify-between gap-2">
                <div>
                    <span className="text-sm font-medium">{label}</span>
                    <span className="text-secondary-400 ml-1.5 text-xs">
                        {description}
                    </span>
                </div>
                <span
                    className={cn(
                        'font-mono text-sm font-semibold tabular-nums',
                        pct === null
                            ? 'text-secondary-400'
                            : isPositive
                              ? 'text-chart-bullish'
                              : 'text-chart-bearish'
                    )}
                >
                    {formattedPct}
                </span>
            </div>

            {/* chart library 없이 RSC-safe하게 렌더링 */}
            <svg
                width="100%"
                height="12"
                aria-hidden="true"
                role="presentation"
                className="overflow-visible"
            >
                <rect
                    x="0"
                    y="3"
                    width="100%"
                    height="6"
                    rx="3"
                    className="fill-secondary-700"
                />
                <line
                    x1="50%"
                    y1="1"
                    x2="50%"
                    y2="11"
                    className="stroke-secondary-700"
                    strokeWidth="1"
                />
                {pct !== null && (
                    <rect
                        x={isPositive ? '50%' : `${50 - fillAbs / 2}%`}
                        y="3"
                        width={`${fillAbs / 2}%`}
                        height="6"
                        rx="3"
                        className={
                            isPositive
                                ? 'fill-chart-bullish'
                                : 'fill-chart-bearish'
                        }
                    />
                )}
            </svg>
        </div>
    );
}

/** RSC section: YoY revenue and EPS growth bars (inline SVG). */
export function GrowthChart({ growth }: GrowthChartProps) {
    if (growth === null) {
        return (
            <EmptySectionCard
                headingId={HEADING_ID}
                title="성장성"
                headingClassName={HEADING_CLASS_NAME}
            />
        );
    }

    return (
        <section
            aria-labelledby={HEADING_ID}
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
        >
            <h2 id={HEADING_ID} className={HEADING_CLASS_NAME}>
                성장성
            </h2>
            <p className="text-secondary-400 mb-4 text-xs">
                전년 동기 대비(YoY) 성장률
            </p>
            <div className="divide-secondary-700/50 divide-y">
                <GrowthBar
                    label="매출 성장률"
                    value={growth.growthRevenue}
                    description="Revenue YoY"
                />
                <GrowthBar
                    label="EPS 성장률"
                    value={growth.growthEPS}
                    description="EPS YoY"
                />
            </div>
        </section>
    );
}
