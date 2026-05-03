import type {
    FundamentalRatiosInput,
    FundamentalFinancialScoresInput,
    FundamentalCashFlowInput,
} from '@y0ngha/siglens-core';
import { cn } from '@/lib/cn';

interface FinancialHealthCardProps {
    ratios: FundamentalRatiosInput | null;
    scores: FundamentalFinancialScoresInput | null;
    cashFlow: FundamentalCashFlowInput | null;
}

type BadgeVariant = 'good' | 'warn' | 'bad' | 'neutral';

const BADGE_VARIANT_CLASS: Record<BadgeVariant, string> = {
    good: 'bg-ui-success/10 text-chart-bullish',
    bad: 'bg-ui-danger/10 text-chart-bearish',
    warn: 'bg-ui-warning/10 text-ui-warning',
    neutral: 'bg-secondary-700 text-secondary-400',
};

interface HealthMetricProps {
    label: string;
    value: string;
    hint?: string;
    badge?: { text: string; variant: BadgeVariant };
}

function HealthMetric({ label, value, hint, badge }: HealthMetricProps) {
    const badgeClass =
        badge === undefined ? '' : BADGE_VARIANT_CLASS[badge.variant];

    return (
        <div className="border-secondary-700 flex items-baseline justify-between gap-4 border-b py-2.5 last:border-b-0">
            <div>
                <span className="text-sm font-medium">{label}</span>
                {hint !== undefined && (
                    <span className="text-secondary-400 ml-1.5 text-xs">
                        {hint}
                    </span>
                )}
            </div>
            <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium tabular-nums">
                    {value}
                </span>
                {badge !== undefined && (
                    <span
                        className={cn(
                            'rounded px-1.5 py-0.5 text-xs font-medium',
                            badgeClass
                        )}
                    >
                        {badge.text}
                    </span>
                )}
            </div>
        </div>
    );
}

function altmanBadge(z: number | null): HealthMetricProps['badge'] {
    if (z === null) return undefined;
    if (z > 2.99) return { text: '안전', variant: 'good' };
    if (z > 1.81) return { text: '경계', variant: 'warn' };
    return { text: '위험', variant: 'bad' };
}

function piotroskiBadge(p: number | null): HealthMetricProps['badge'] {
    if (p === null) return undefined;
    if (p >= 8) return { text: '강함', variant: 'good' };
    if (p >= 5) return { text: '보통', variant: 'neutral' };
    return { text: '약함', variant: 'bad' };
}

export function FinancialHealthCard({
    ratios,
    scores,
    cashFlow,
}: FinancialHealthCardProps) {
    if (ratios === null && scores === null) return null;

    const formattedOcf =
        cashFlow?.operatingCashFlow !== null &&
        cashFlow?.operatingCashFlow !== undefined
            ? new Intl.NumberFormat('ko-KR', {
                  notation: 'compact',
                  maximumFractionDigits: 1,
                  style: 'currency',
                  currency: 'USD',
              }).format(cashFlow.operatingCashFlow)
            : '—';

    return (
        <section
            aria-labelledby="health-heading"
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
        >
            <h2
                id="health-heading"
                className="mb-4 text-lg font-semibold tracking-tight"
            >
                재무 건전성
            </h2>
            <div>
                <HealthMetric
                    label="부채 비율"
                    value={
                        ratios?.debtRatioTTM !== null &&
                        ratios?.debtRatioTTM !== undefined
                            ? ratios.debtRatioTTM.toFixed(2)
                            : '—'
                    }
                    hint="Debt Ratio (TTM)"
                />
                <HealthMetric
                    label="유동 비율"
                    value={
                        ratios?.currentRatioTTM !== null &&
                        ratios?.currentRatioTTM !== undefined
                            ? ratios.currentRatioTTM.toFixed(2)
                            : '—'
                    }
                    hint="Current Ratio (TTM)"
                />
                <HealthMetric
                    label="영업 현금흐름"
                    value={formattedOcf}
                    hint="Operating Cash Flow"
                />
                <HealthMetric
                    label="알트만 Z-Score"
                    value={
                        scores?.altmanZScore !== null &&
                        scores?.altmanZScore !== undefined
                            ? scores.altmanZScore.toFixed(2)
                            : '—'
                    }
                    hint="파산 위험 지수"
                    badge={altmanBadge(scores?.altmanZScore ?? null)}
                />
                <HealthMetric
                    label="피오트로스키 F-Score"
                    value={
                        scores?.piotroskiScore !== null &&
                        scores?.piotroskiScore !== undefined
                            ? String(scores.piotroskiScore)
                            : '—'
                    }
                    hint="재무 건강 점수 (0–9)"
                    badge={piotroskiBadge(scores?.piotroskiScore ?? null)}
                />
            </div>
        </section>
    );
}
