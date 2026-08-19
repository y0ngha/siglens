import { useTranslations } from 'next-intl';
import { EmptySectionCard } from './EmptySectionCard';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
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
                    <span className="ml-1.5 text-xs text-secondary-400">
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
                    className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary-700"
                >
                    <div
                        className="h-full w-(--fill-pct) rounded-full bg-primary-600 transition-[width]"
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
    const t = useTranslations('widgets.fundamental');
    if (ratios === null) {
        return (
            <EmptySectionCard
                headingId={HEADING_ID}
                title={t('ProfitabilityCard.83c700')}
                headingClassName={HEADING_CLASS_NAME}
            />
        );
    }

    return (
        <section
            aria-labelledby={HEADING_ID}
            className="rounded-xl border border-secondary-700 bg-secondary-800 p-6"
        >
            <h2 id={HEADING_ID} className={HEADING_CLASS_NAME}>
                {t('ProfitabilityCard.83c700')}
            </h2>
            <div className="divide-y divide-secondary-700/50">
                <MetricBar
                    label="ROE"
                    value={ratios.returnOnEquityTTM}
                    description={t('ProfitabilityCard.6a5d30')}
                    tooltip={
                        <>
                            <p>{t('ProfitabilityCard.d73ac0')}</p>
                            <p>{t('ProfitabilityCard.f5d222')}</p>
                        </>
                    }
                />
                <MetricBar
                    label="ROA"
                    value={ratios.returnOnAssetsTTM}
                    description={t('ProfitabilityCard.077012')}
                    tooltip={
                        <>
                            <p>{t('ProfitabilityCard.7a7512')}</p>
                            <p>{t('ProfitabilityCard.d3c380')}</p>
                        </>
                    }
                />
                <MetricBar
                    label={t('ProfitabilityCard.c62afe')}
                    value={ratios.operatingProfitMarginTTM}
                    description="Operating Margin"
                    tooltip={
                        <>
                            <p>{t('ProfitabilityCard.b3a38b')}</p>
                            <p>{t('ProfitabilityCard.3e2d28')}</p>
                        </>
                    }
                />
                <MetricBar
                    label={t('ProfitabilityCard.d1ca4f')}
                    value={ratios.netProfitMarginTTM}
                    description="Net Margin"
                    tooltip={
                        <>
                            <p>{t('ProfitabilityCard.f77781')}</p>
                            <p>{t('ProfitabilityCard.5fec55')}</p>
                        </>
                    }
                />
            </div>
        </section>
    );
}
