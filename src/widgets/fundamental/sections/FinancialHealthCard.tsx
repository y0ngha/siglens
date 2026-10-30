/**
 * 재무 건전성 카드 — 지표 값 계산은 `utils/`, 한 줄 렌더는 `ui/financial-health/`가 맡는다.
 */
import { useTranslations } from 'next-intl';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import type {
    FundamentalRatiosInput,
    FundamentalFinancialScoresInput,
    FundamentalCashFlowInput,
} from '@y0ngha/siglens-core';
import { EmptySectionCard } from '@/shared/ui/EmptySectionCard';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HealthMetric } from '@/widgets/fundamental/ui/financial-health/HealthMetric';
import {
    altmanBadge,
    piotroskiBadge,
} from '@/widgets/fundamental/utils/healthBadges';
import { formatFixed } from '@/widgets/fundamental/utils/moneyFormat';
import { formatOperatingCashFlow } from '@/widgets/fundamental/utils/operatingCashFlow';

const HEADING_ID = 'health-heading';
const HEADING_CLASS_NAME = cn('mb-4', HEADING_SECTION);

interface FinancialHealthCardProps {
    /** 표기 통화를 정하기 위해 필요하다 — 국내 종목은 원화다. */
    symbol: string;
    ratios: FundamentalRatiosInput | null;
    scores: FundamentalFinancialScoresInput | null;
    cashFlow: FundamentalCashFlowInput | null;
}

/** 재무 건전성 카드 — 부채·유동비율·영업현금흐름·Altman Z·Piotroski F를 한 줄씩 보여 준다. */
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

    const formattedOcf = formatOperatingCashFlow(cashFlow, symbol, locale);

    return (
        <section
            aria-labelledby={HEADING_ID}
            className={cn(SURFACE_CARD, 'p-6')}
        >
            <h2 id={HEADING_ID} className={HEADING_CLASS_NAME}>
                {t('FinancialHealthCard.ac568f')}
            </h2>
            <div>
                <HealthMetric
                    label={t('FinancialHealthCard.c0a6fb')}
                    value={formatFixed(ratios?.debtRatioTTM)}
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
                    value={formatFixed(ratios?.currentRatioTTM)}
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
                    value={formatFixed(scores?.altmanZScore)}
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
                    value={formatFixed(scores?.piotroskiScore, 0)}
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
