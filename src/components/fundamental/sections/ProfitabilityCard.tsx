import type { CSSProperties } from 'react';
import type { FundamentalRatiosInput } from '@y0ngha/siglens-core';

interface ProfitabilityCardProps {
    ratios: FundamentalRatiosInput;
}

interface MetricBarProps {
    label: string;
    value: number | null;
    description: string;
}

function MetricBar({ label, value, description }: MetricBarProps) {
    const displayValue = value !== null ? `${(value * 100).toFixed(1)}%` : '—';

    // Clamp fill width 0–100% for progress bar visualisation (ratio expected 0–1)
    const fillPct =
        value !== null ? Math.min(100, Math.max(0, value * 100)) : 0;

    return (
        <div className="py-2.5">
            <div className="flex items-baseline justify-between gap-2">
                <div>
                    <span className="text-sm font-medium">{label}</span>
                    <span className="text-secondary-400 ml-1.5 text-xs">
                        {description}
                    </span>
                </div>
                <span className="font-mono text-sm font-medium tabular-nums">
                    {displayValue}
                </span>
            </div>
            {value !== null && (
                <div
                    role="presentation"
                    aria-hidden="true"
                    className="bg-secondary-700 mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
                >
                    <div
                        className="bg-primary-600 h-full w-[var(--fill-pct)] rounded-full transition-all"
                        style={
                            {
                                '--fill-pct': `${fillPct}%`,
                            } as CSSProperties
                        }
                    />
                </div>
            )}
        </div>
    );
}

/**
 * RSC section: TTM profitability metrics — ROE, ROA, operating margin,
 * net margin — visualised with subtle progress bars.
 *
 * Data is fetched by the parent RSC page and passed as a typed prop.
 */
export function ProfitabilityCard({ ratios }: ProfitabilityCardProps) {
    return (
        <section
            aria-labelledby="profitability-heading"
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
        >
            <h2
                id="profitability-heading"
                className="mb-2 text-lg font-semibold tracking-tight"
            >
                수익성
            </h2>
            <div className="divide-secondary-700/50 divide-y">
                <MetricBar
                    label="ROE"
                    value={ratios.returnOnEquityTTM}
                    description="자기자본이익률"
                />
                <MetricBar
                    label="ROA"
                    value={ratios.returnOnAssetsTTM}
                    description="총자산이익률"
                />
                <MetricBar
                    label="영업이익률"
                    value={ratios.operatingProfitMarginTTM}
                    description="Operating Margin"
                />
                <MetricBar
                    label="순이익률"
                    value={ratios.netProfitMarginTTM}
                    description="Net Margin"
                />
            </div>
        </section>
    );
}
