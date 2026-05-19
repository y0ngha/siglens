import type { ReactNode } from 'react';
import type {
    FundamentalRatiosInput,
    FundamentalFinancialScoresInput,
    FundamentalCashFlowInput,
} from '@y0ngha/siglens-core';
import { EmptySectionCard } from '@/components/fundamental/sections/EmptySectionCard';
import { cn } from '@/lib/cn';
import { InfoTooltip } from '@/components/ui/InfoTooltip';

const HEADING_ID = 'health-heading';
const HEADING_CLASS_NAME = 'mb-4 text-lg font-semibold tracking-tight';

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
    tooltip?: ReactNode;
}

function HealthMetric({
    label,
    value,
    hint,
    badge,
    tooltip,
}: HealthMetricProps) {
    const badgeClass =
        badge === undefined ? '' : BADGE_VARIANT_CLASS[badge.variant];

    return (
        <div className="border-secondary-700 flex items-baseline justify-between gap-4 border-b py-2.5 last:border-b-0">
            <div>
                <span className="text-sm font-medium">{label}</span>
                {tooltip !== undefined && <InfoTooltip>{tooltip}</InfoTooltip>}
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
    if (ratios === null && scores === null && cashFlow === null) {
        return (
            <EmptySectionCard
                headingId={HEADING_ID}
                title="재무 건전성"
                headingClassName={HEADING_CLASS_NAME}
            />
        );
    }

    const ocf = cashFlow?.operatingCashFlow ?? null;
    const formattedOcf =
        ocf !== null
            ? new Intl.NumberFormat('ko-KR', {
                  notation: 'compact',
                  maximumFractionDigits: 1,
                  style: 'currency',
                  currency: 'USD',
              }).format(ocf)
            : '—';

    return (
        <section
            aria-labelledby={HEADING_ID}
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
        >
            <h2 id={HEADING_ID} className={HEADING_CLASS_NAME}>
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
                    tooltip={
                        <>
                            <p>회사 자산 중 빚이 차지하는 비중이에요.</p>
                            <p>
                                0.5 이하면 양호, 0.7 이상이면 부채 부담이 큰
                                편이에요.
                            </p>
                            <p>너무 높으면 재무 위험이 커진다는 뜻이에요.</p>
                        </>
                    }
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
                    tooltip={
                        <>
                            <p>
                                1년 안에 갚아야 할 빚을, 1년 안에 현금화할 수
                                있는 자산으로 갚을 수 있는지 보여주는 값이에요.
                            </p>
                            <p>1.5 이상이면 단기 자금 사정이 양호해요.</p>
                            <p>
                                1 미만이면 단기 자금난 위험이 있다는 뜻이에요.
                            </p>
                        </>
                    }
                />
                <HealthMetric
                    label="영업 현금흐름"
                    value={formattedOcf}
                    hint="Operating Cash Flow"
                    tooltip={
                        <>
                            <p>
                                본업으로 실제로 들어온 현금이 얼마인지 보여주는
                                값이에요.
                            </p>
                            <p>
                                양수(+)면 본업으로 돈을 잘 벌고 있다는 뜻이에요.
                            </p>
                            <p>음수(−)면 영업에서 적자가 났다는 의미예요.</p>
                        </>
                    }
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
                    tooltip={
                        <>
                            <p>회사의 파산 가능성을 예측하는 점수예요.</p>
                            <p>
                                2.99 이상이면 안전, 1.81~2.99는 경계 구간이에요.
                            </p>
                            <p>1.81 이하면 파산 위험 신호로 해석해요.</p>
                        </>
                    }
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
                    tooltip={
                        <>
                            <p>
                                9가지 재무 기준을 점수로 합산해 재무 건강 상태를
                                평가하는 값이에요(0~9점).
                            </p>
                            <p>8~9점이면 매우 강함, 5~7점이면 보통이에요.</p>
                            <p>4점 이하면 재무 상태가 약하다는 뜻이에요.</p>
                        </>
                    }
                />
            </div>
        </section>
    );
}
