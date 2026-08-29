import { useTranslations } from 'next-intl';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import type { ReactNode } from 'react';
import type {
    FundamentalRatiosInput,
    FundamentalFinancialScoresInput,
    FundamentalCashFlowInput,
} from '@y0ngha/siglens-core';
import { EmptySectionCard } from './EmptySectionCard';
import { cn } from '@/shared/lib/cn';
import { formatCompactCurrency } from '@/shared/lib/priceFormat';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import type { EnumLabelTranslator } from '@/shared/lib/enumLabelTranslator';

const HEADING_ID = 'health-heading';
const HEADING_CLASS_NAME = cn('mb-4', HEADING_SECTION);

interface FinancialHealthCardProps {
    /** 표기 통화를 정하기 위해 필요하다 — 국내 종목은 원화다. */
    symbol: string;
    ratios: FundamentalRatiosInput | null;
    scores: FundamentalFinancialScoresInput | null;
    cashFlow: FundamentalCashFlowInput | null;
}

type BadgeVariant = 'good' | 'warn' | 'bad' | 'neutral';

const BADGE_VARIANT_CLASS: Record<BadgeVariant, string> = {
    good: 'bg-ui-success/10 text-ui-success-text',
    bad: 'bg-ui-danger/10 text-ui-danger-text',
    warn: 'bg-ui-warning/10 text-ui-warning-text',
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
        <div className="flex items-baseline justify-between gap-4 border-b border-secondary-700 py-2.5 last:border-b-0">
            <div>
                <span className="text-sm font-medium">{label}</span>
                {tooltip !== undefined && <InfoTooltip>{tooltip}</InfoTooltip>}
                {hint !== undefined && (
                    <span className="ml-1.5 text-xs text-secondary-400">
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

/**
 * Altman Z-Score 구간 → 배지. `financialHealthZone.*` 카탈로그 키를 쓴다
 * (신규 그룹 — 값 자체가 riskLevel/기존 그룹 어디와도 겹치지 않는다).
 */
function altmanBadge(
    z: number | null,
    t: EnumLabelTranslator
): HealthMetricProps['badge'] {
    if (z === null) return undefined;
    if (z > 2.99)
        return { text: t('financialHealthZone.safe'), variant: 'good' };
    if (z > 1.81)
        return { text: t('financialHealthZone.caution'), variant: 'warn' };
    return { text: t('financialHealthZone.danger'), variant: 'bad' };
}

/**
 * Piotroski F-Score 구간 → 배지. 중간 구간("보통")은 `riskLevel.medium`을
 * 재사용한다 — 값이 이미 riskLevel 그룹과 같아 새 키를 또 만들지 않는다.
 */
function piotroskiBadge(
    p: number | null,
    t: EnumLabelTranslator
): HealthMetricProps['badge'] {
    if (p === null) return undefined;
    if (p >= 8)
        return { text: t('financialHealthZone.strong'), variant: 'good' };
    if (p >= 5) return { text: t('riskLevel.medium'), variant: 'neutral' };
    return { text: t('financialHealthZone.weak'), variant: 'bad' };
}

export function FinancialHealthCard({
    symbol,
    ratios,
    scores,
    cashFlow,
}: FinancialHealthCardProps) {
    const t = useTranslations('widgets.fundamental');
    const locale = useResolvedLocale();
    const tLabel = useTranslations('shared.enumLabel');
    if (ratios === null && scores === null && cashFlow === null) {
        return (
            <EmptySectionCard
                headingId={HEADING_ID}
                title={t('FinancialHealthCard.ac568f')}
                headingClassName={HEADING_CLASS_NAME}
            />
        );
    }

    const ocf = cashFlow?.operatingCashFlow ?? null;
    const formattedOcf =
        ocf !== null ? formatCompactCurrency(ocf, symbol, locale) : '—';

    return (
        <section
            aria-labelledby={HEADING_ID}
            className="rounded-lg border border-secondary-700 bg-secondary-800 p-6"
        >
            <h2 id={HEADING_ID} className={HEADING_CLASS_NAME}>
                {t('FinancialHealthCard.ac568f')}
            </h2>
            <div>
                <HealthMetric
                    label={t('FinancialHealthCard.c0a6fb')}
                    value={
                        ratios?.debtRatioTTM !== null &&
                        ratios?.debtRatioTTM !== undefined
                            ? ratios.debtRatioTTM.toFixed(2)
                            : '—'
                    }
                    hint="Debt Ratio (TTM)"
                    tooltip={
                        <>
                            <p>{t('FinancialHealthCard.3d0688')}</p>
                            <p>{t('FinancialHealthCard.b498a9')}</p>
                            <p>{t('FinancialHealthCard.7a2219')}</p>
                        </>
                    }
                />
                <HealthMetric
                    label={t('FinancialHealthCard.3276b7')}
                    value={
                        ratios?.currentRatioTTM !== null &&
                        ratios?.currentRatioTTM !== undefined
                            ? ratios.currentRatioTTM.toFixed(2)
                            : '—'
                    }
                    hint="Current Ratio (TTM)"
                    tooltip={
                        <>
                            <p>{t('FinancialHealthCard.b9b78b')}</p>
                            <p>{t('FinancialHealthCard.cfc585')}</p>
                            <p>{t('FinancialHealthCard.a65741')}</p>
                        </>
                    }
                />
                <HealthMetric
                    label={t('FinancialHealthCard.90cbfe')}
                    value={formattedOcf}
                    hint="Operating Cash Flow"
                    tooltip={
                        <>
                            <p>{t('FinancialHealthCard.41cf1e')}</p>
                            <p>{t('FinancialHealthCard.9673b2')}</p>
                            <p>{t('FinancialHealthCard.f40fe3')}</p>
                        </>
                    }
                />
                <HealthMetric
                    label={t('FinancialHealthCard.de7562')}
                    value={
                        scores?.altmanZScore !== null &&
                        scores?.altmanZScore !== undefined
                            ? scores.altmanZScore.toFixed(2)
                            : '—'
                    }
                    hint={t('FinancialHealthCard.869609')}
                    badge={altmanBadge(scores?.altmanZScore ?? null, tLabel)}
                    tooltip={
                        <>
                            <p>{t('FinancialHealthCard.fee63b')}</p>
                            <p>{t('FinancialHealthCard.4f21e5')}</p>
                            <p>{t('FinancialHealthCard.ec93ad')}</p>
                        </>
                    }
                />
                <HealthMetric
                    label={t('FinancialHealthCard.093acd')}
                    value={
                        scores?.piotroskiScore !== null &&
                        scores?.piotroskiScore !== undefined
                            ? String(scores.piotroskiScore)
                            : '—'
                    }
                    hint={t('FinancialHealthCard.e5bd4a')}
                    badge={piotroskiBadge(
                        scores?.piotroskiScore ?? null,
                        tLabel
                    )}
                    tooltip={
                        <>
                            <p>{t('FinancialHealthCard.d8fb76')}</p>
                            <p>{t('FinancialHealthCard.b78ec7')}</p>
                            <p>{t('FinancialHealthCard.f7f467')}</p>
                        </>
                    }
                />
            </div>
        </section>
    );
}
