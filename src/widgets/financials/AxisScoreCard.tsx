import type React from 'react';
import type {
    AxisScore,
    FinancialsAxis,
    FinancialsGrade,
    FinancialSignal,
    FinancialSignalDirection,
    ScoreMetric,
    ScoreMetricUnit,
} from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { usdFormatter } from './utils/numberFormat';

interface AxisScoreCardProps {
    /** Korean axis title displayed as the card heading. */
    title: string;
    /** Stable English key for the axis used in DOM ids (avoids Korean in id attributes). */
    axisKey: FinancialsAxis;
    /** Axis score object from the financials scorecard. */
    axis: AxisScore;
}

/** Grade badge background + text colors (grade-ramp tokens). */
const GRADE_BADGE_CLASS: Record<FinancialsGrade, string> = {
    A: 'bg-grade-a/10 text-grade-a',
    B: 'bg-grade-b/10 text-grade-b',
    C: 'bg-grade-c/10 text-grade-c',
    D: 'bg-grade-d/10 text-grade-d',
    F: 'bg-grade-f/10 text-ui-danger-text', // AA chip text (text-sm bold); CompositeGradeGauge의 text-4xl 등급 글자는 text-grade-f 유지 (대형 텍스트 3:1 통과)
};

/** Signal chip colors keyed by direction. */
const SIGNAL_CHIP_CLASS: Record<FinancialSignalDirection, string> = {
    positive:
        'bg-chart-bullish/10 text-ui-success-text border-chart-bullish/20',
    negative: 'bg-chart-bearish/10 text-ui-danger-text border-chart-bearish/20',
    neutral: 'bg-secondary-700 text-secondary-300 border-secondary-600',
};

/**
 * Format a ScoreMetric value according to its unit.
 *
 * - `pct`   → "12.5%"
 * - `ratio` → "2.1x"
 * - `usd`   → compact currency (e.g. "$5B")
 * - `score` → raw integer string
 * - `null`  → "—"
 */
function formatMetricValue(
    value: number | null,
    unit: ScoreMetricUnit
): string {
    if (value === null) return '—';

    switch (unit) {
        case 'pct':
            return `${value.toFixed(1)}%`;
        case 'ratio':
            return `${value.toFixed(2)}x`;
        case 'usd':
            return usdFormatter.format(value);
        case 'score':
            return String(Math.round(value));
    }
}

/** Progress bar for the axis score (0–100), colored by grade (grade-ramp tokens). */
const PROGRESS_GRADE_COLOR: Record<FinancialsGrade, string> = {
    A: 'bg-grade-a',
    B: 'bg-grade-b',
    C: 'bg-grade-c',
    D: 'bg-grade-d',
    F: 'bg-grade-f',
};

interface SignalChipProps {
    signal: FinancialSignal;
}

function SignalChip({ signal }: SignalChipProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium',
                SIGNAL_CHIP_CLASS[signal.direction]
            )}
        >
            {signal.labelKo}
        </span>
    );
}

interface MetricRowProps {
    metric: ScoreMetric;
}

function MetricRow({ metric }: MetricRowProps) {
    return (
        <div className="border-secondary-700 flex items-baseline justify-between gap-2 border-b py-1.5 last:border-b-0">
            <span className="text-secondary-300 text-xs">{metric.labelKo}</span>
            <span className="font-mono text-xs font-medium tabular-nums">
                {formatMetricValue(metric.value, metric.unit)}
            </span>
        </div>
    );
}

/**
 * Card showing score, grade, signal chips, and key metrics for one scorecard axis.
 *
 * Displays:
 * - Card heading with the Korean axis title
 * - Score progress bar + grade badge
 * - Signal chips (each colored by direction: positive/negative/neutral)
 * - Key metrics list (value formatted by unit)
 */
export function AxisScoreCard({ title, axisKey, axis }: AxisScoreCardProps) {
    const { score, grade, signals, metrics } = axis;
    const gradeBadgeClass = GRADE_BADGE_CLASS[grade];
    const progressColorClass = PROGRESS_GRADE_COLOR[grade];

    return (
        <section
            aria-labelledby={`axis-${axisKey}-heading`}
            className="border-secondary-700 bg-secondary-800 flex flex-col gap-4 rounded-xl border p-4 sm:p-6"
        >
            <div className="flex items-center justify-between">
                <h3
                    id={`axis-${axisKey}-heading`}
                    className="text-secondary-100 text-base font-semibold tracking-tight"
                >
                    {title}
                </h3>
                <span
                    className={cn(
                        'rounded px-2 py-0.5 text-sm font-bold',
                        gradeBadgeClass
                    )}
                >
                    {grade}
                </span>
            </div>

            <div>
                <div className="mb-1 flex items-baseline justify-between">
                    <span className="text-secondary-400 text-xs">점수</span>
                    <span className="text-secondary-100 font-mono text-sm font-semibold tabular-nums">
                        {score}
                    </span>
                </div>
                <div
                    className="bg-secondary-700 h-1.5 w-full overflow-hidden rounded-full"
                    style={
                        {
                            '--axis-score-pct': `${score}%`,
                        } as React.CSSProperties
                    }
                >
                    <div
                        className={cn(
                            'h-full w-[var(--axis-score-pct)] rounded-full',
                            progressColorClass
                        )}
                    />
                </div>
            </div>

            {signals.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {signals.map(signal => (
                        <SignalChip key={signal.type} signal={signal} />
                    ))}
                </div>
            )}

            {metrics.length > 0 && (
                <div>
                    {metrics.map(metric => (
                        <MetricRow key={metric.labelKo} metric={metric} />
                    ))}
                </div>
            )}
        </section>
    );
}
