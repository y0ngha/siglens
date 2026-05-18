import { EmptySectionCard } from '@/components/fundamental/sections/EmptySectionCard';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import type { FundamentalRatiosInput } from '@y0ngha/siglens-core';
import type { CSSProperties, ReactNode } from 'react';

const HEADING_ID = 'profitability-heading';
const HEADING_CLASS_NAME = 'mb-2 text-lg font-semibold tracking-tight';

interface ProfitabilityCardProps {
    ratios: FundamentalRatiosInput | null;
}

interface MetricBarProps {
    label: string;
    value: number | null;
    description: string;
    tooltip?: ReactNode;
}

function MetricBar({ label, value, description, tooltip }: MetricBarProps) {
    const displayValue = value !== null ? `${(value * 100).toFixed(1)}%` : '—';

    // Clamp fill width 0–100% for progress bar visualisation (ratio expected 0–1)
    const fillPct =
        value !== null ? Math.min(100, Math.max(0, value * 100)) : 0;

    return (
        <div className="py-2.5">
            <div className="flex items-baseline justify-between gap-2">
                <div>
                    <span className="text-sm font-medium">{label}</span>
                    {tooltip !== undefined && (
                        <InfoTooltip>{tooltip}</InfoTooltip>
                    )}
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
                        className="bg-primary-600 h-full w-(--fill-pct) rounded-full transition-all"
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

export function ProfitabilityCard({ ratios }: ProfitabilityCardProps) {
    if (ratios === null) {
        return (
            <EmptySectionCard
                headingId={HEADING_ID}
                title="수익성"
                headingClassName={HEADING_CLASS_NAME}
            />
        );
    }

    return (
        <section
            aria-labelledby={HEADING_ID}
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
        >
            <h2
                id={HEADING_ID}
                className={HEADING_CLASS_NAME}
            >
                수익성
            </h2>
            <div className="divide-secondary-700/50 divide-y">
                <MetricBar
                    label="ROE"
                    value={ratios.returnOnEquityTTM}
                    description="자기자본이익률"
                    tooltip={
                        <>
                            <p>
                                주주가 투자한 돈으로 얼마만큼 이익을 냈는지
                                보여주는 비율이에요.
                            </p>
                            <p>
                                15% 이상이면 우수, 10~15%면 양호, 그 아래면
                                평범한 수준으로 봐요.
                            </p>
                        </>
                    }
                />
                <MetricBar
                    label="ROA"
                    value={ratios.returnOnAssetsTTM}
                    description="총자산이익률"
                    tooltip={
                        <>
                            <p>
                                회사가 가진 자산 전체로 얼마만큼 이익을 냈는지
                                보여주는 비율이에요.
                            </p>
                            <p>
                                자산을 얼마나 효율적으로 굴리는지 알 수 있고, 5%
                                이상이면 양호한 편이에요.
                            </p>
                        </>
                    }
                />
                <MetricBar
                    label="영업이익률"
                    value={ratios.operatingProfitMarginTTM}
                    description="Operating Margin"
                    tooltip={
                        <>
                            <p>
                                매출 100원당 본업으로 몇 원이 남는지 보여주는
                                비율이에요.
                            </p>
                            <p>
                                핵심 사업의 체력을 가장 잘 드러내고, 높을수록
                                사업이 탄탄하다는 뜻이에요.
                            </p>
                        </>
                    }
                />
                <MetricBar
                    label="순이익률"
                    value={ratios.netProfitMarginTTM}
                    description="Net Margin"
                    tooltip={
                        <>
                            <p>
                                매출 100원에서 모든 비용·세금을 뺐을 때 실제로
                                몇 원이 남는지 보여줘요.
                            </p>
                            <p>
                                회사의 최종 수익성을 한눈에 보여주는 지표예요.
                            </p>
                        </>
                    }
                />
            </div>
        </section>
    );
}
