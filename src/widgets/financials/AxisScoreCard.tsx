import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import type { Locale } from '@/shared/i18n/locales';
import { useTranslations } from 'next-intl';
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
import {
    formatCurrencyCompact,
    DEFAULT_STATEMENT_CURRENCY,
    type StatementCurrency,
} from './utils/numberFormat';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';

interface AxisScoreCardProps {
    /** Korean axis title displayed as the card heading. */
    title: string;
    /** Stable English key for the axis used in DOM ids (avoids Korean in id attributes). */
    axisKey: FinancialsAxis;
    /** Axis score object from the financials scorecard. */
    axis: AxisScore;
    /** 금액 지표에 적용할 통화. 생략하면 USD — 미국 종목의 기존 동작. */
    currency?: StatementCurrency;
}

/** Grade badge background + text colors (grade-ramp tokens). */
const GRADE_BADGE_CLASS: Record<FinancialsGrade, string> = {
    // 칩 텍스트는 `-text` 변형을 쓴다 — 기본 `grade-*`는 게이지 스트로크와
    // 36px 대형 등급 글자(3:1)를 겨냥한 값이라, 자기 /10 틴트 위 14px 굵은
    // 글씨로 쓰면 라이트에서 4.32~4.48:1로 AA에 미달한다(실측).
    // `CompositeGradeGauge`의 text-4xl 글자와 스트로크는 기본 토큰을 그대로 쓴다.
    A: 'bg-grade-a/10 text-grade-a-text',
    B: 'bg-grade-b/10 text-grade-b-text',
    C: 'bg-grade-c/10 text-grade-c-text',
    D: 'bg-grade-d/10 text-grade-d-text',
    F: 'bg-grade-f/10 text-grade-f-text',
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
    unit: ScoreMetricUnit,
    currency: StatementCurrency,
    locale: Locale
): string {
    if (value === null) return '—';

    switch (unit) {
        case 'pct':
            return `${value.toFixed(1)}%`;
        case 'ratio':
            return `${value.toFixed(2)}x`;
        // 'usd'는 "금액" 단위를 뜻하는 레거시 라벨이다 — 실제 통화는 `currency`가 정한다.
        case 'usd':
            return formatCurrencyCompact(value, currency, locale);
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
    currency: StatementCurrency;
}

function MetricRow({ metric, currency }: MetricRowProps) {
    const locale = useResolvedLocale();
    return (
        <div className="flex items-baseline justify-between gap-2 border-b border-secondary-700 py-1.5 last:border-b-0">
            <span className="text-xs text-secondary-300">{metric.labelKo}</span>
            <span className="font-mono text-xs font-medium tabular-nums">
                {formatMetricValue(metric.value, metric.unit, currency, locale)}
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
export function AxisScoreCard({
    title,
    axisKey,
    axis,
    currency = DEFAULT_STATEMENT_CURRENCY,
}: AxisScoreCardProps) {
    const t = useTranslations('widgets.financials');
    const { score, grade, signals, metrics } = axis;
    const gradeBadgeClass = GRADE_BADGE_CLASS[grade];
    const progressColorClass = PROGRESS_GRADE_COLOR[grade];

    return (
        <section
            aria-labelledby={`axis-${axisKey}-heading`}
            className="flex flex-col gap-4 rounded-lg border border-secondary-700 bg-secondary-800 p-4 sm:p-6"
        >
            <div className="flex items-center justify-between">
                <h3
                    id={`axis-${axisKey}-heading`}
                    className={HEADING_SUBSECTION}
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
                    <span className="text-xs text-secondary-400">
                        {t('AxisScoreCard.67d2cf')}
                    </span>
                    <span className="font-mono text-sm font-semibold text-secondary-100 tabular-nums">
                        {score}
                    </span>
                </div>
                <div
                    className="h-1.5 w-full overflow-hidden rounded-full bg-secondary-700"
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
                        <MetricRow
                            key={metric.labelKo}
                            metric={metric}
                            currency={currency}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
