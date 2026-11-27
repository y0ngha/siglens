import type { FundamentalValuationMetrics } from '@y0ngha/siglens-core';
/**
 * 밸류에이션 카드 — PER·PSR·PBR·PEG·EV/EBITDA·EPS 한 줄씩.
 */
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { KrValuationBasis } from '@/entities/kr-valuation/model';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { EmptySectionCard } from '@/shared/ui/EmptySectionCard';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import { formatDecimal } from '@/widgets/fundamental/utils/decimalFormat';

const HEADING_ID = 'valuation-heading';
const HEADING_CLASS_NAME = cn('mb-4', HEADING_SECTION);

interface ValuationCardProps {
    metrics: FundamentalValuationMetrics | null;
    /**
     * 한국 종목의 PER·PBR 계산 기준. 있으면 카드 아래에 기준 한 줄을 붙인다 — 에이전트가 같은 기준을 말하므로 화면도 밝힌다.
     * 미국·크립토 종목이거나 기준을 구하지 못했으면 null.
     */
    basis?: KrValuationBasis | null;
}

interface MetricRowProps {
    label: string;
    value: number | null;
    description: string;
    digits?: number;
    tooltip?: ReactNode;
}

/** 배수 라벨·설명과 로케일 표기 값을 한 줄로 그린다. */
function MetricRow({
    label,
    value,
    description,
    digits = 2,
    tooltip,
}: MetricRowProps) {
    const locale = useResolvedLocale();
    const formatted =
        value !== null ? formatDecimal(value, digits, locale) : '-';

    return (
        <div className="flex items-baseline justify-between gap-4 border-b border-secondary-700 py-2.5 last:border-b-0">
            <div>
                <span className="text-sm font-medium" translate="no">
                    {label}
                </span>
                {tooltip !== undefined && <InfoTooltip>{tooltip}</InfoTooltip>}
                <span className="ml-1.5 text-xs text-secondary-400">
                    {description}
                </span>
            </div>
            <span className="font-mono text-sm font-medium tabular-nums">
                {formatted}
            </span>
        </div>
    );
}

/**
 * 한국 종목 PER·PBR의 계산 기준 한 줄. 번역 키는 리터럴로 적는다(스캐너가 정적으로 읽는다). 순이익 기간(`ttmEnd`)을 모르면
 * PER이 비어 있으니 자본 기준만 말한다.
 */
function KrBasisCaption({ basis }: { basis: KrValuationBasis }) {
    const t = useTranslations('widgets.fundamental');
    const dates = {
        ttmEnd: basis.ttmEnd ?? '',
        equityAsOf: basis.equityAsOf ?? '',
    };
    const textOf = (): string => {
        if (basis.source === 'provider')
            return t('ValuationCard.krBasisProvider');
        if (basis.ttmEnd === null) {
            return t('ValuationCard.krBasisDartEquityOnly', dates);
        }
        return basis.statements === 'separate'
            ? t('ValuationCard.krBasisDartSeparate', dates)
            : t('ValuationCard.krBasisDartConsolidated', dates);
    };
    const text = textOf();
    return (
        <p className="mt-3 text-xs leading-relaxed text-secondary-400">
            {text}
        </p>
    );
}

/** 밸류에이션 카드. 지표가 없으면 빈 카드를 그린다. */
export function ValuationCard({ metrics, basis = null }: ValuationCardProps) {
    const t = useTranslations('widgets.fundamental');
    if (metrics === null) {
        return (
            <EmptySectionCard
                headingId={HEADING_ID}
                title={t('ValuationCard.12a32f')}
                headingClassName={HEADING_CLASS_NAME}
            />
        );
    }

    return (
        <section
            aria-labelledby={HEADING_ID}
            className={cn(SURFACE_CARD, 'p-6')}
        >
            <h2 id={HEADING_ID} className={HEADING_CLASS_NAME}>
                {t('ValuationCard.12a32f')}
            </h2>
            <div>
                <MetricRow
                    label="PER"
                    value={metrics.peRatioTTM}
                    description={t('ValuationCard.a02a9a')}
                    digits={1}
                    tooltip={
                        <>
                            <p>{t('ValuationCard.634f35')}</p>
                            <p>{t('ValuationCard.f63f21')}</p>
                            <p>{t('ValuationCard.28586e')}</p>
                        </>
                    }
                />
                <MetricRow
                    label="PSR"
                    value={metrics.priceToSalesRatioTTM}
                    description={t('ValuationCard.8a717e')}
                    tooltip={
                        <>
                            <p>{t('ValuationCard.a56ae3')}</p>
                            <p>{t('ValuationCard.9dbbcf')}</p>
                            <p>{t('ValuationCard.4e6c09')}</p>
                        </>
                    }
                />
                <MetricRow
                    label="PBR"
                    value={metrics.pbRatioTTM}
                    description={t('ValuationCard.d9788e')}
                    tooltip={
                        <>
                            <p>{t('ValuationCard.132b50')}</p>
                            <p>{t('ValuationCard.0f77d0')}</p>
                            <p>{t('ValuationCard.b499b2')}</p>
                        </>
                    }
                />
                <MetricRow
                    label="PEG"
                    value={metrics.pegRatioTTM}
                    description={t('ValuationCard.41b238')}
                    tooltip={
                        <>
                            <p>{t('ValuationCard.f4d48c')}</p>
                            <p>{t('ValuationCard.68e99d')}</p>
                        </>
                    }
                />
                <MetricRow
                    label="EV/EBITDA"
                    value={metrics.enterpriseValueOverEBITDATTM}
                    description={t('ValuationCard.d7d691')}
                    digits={1}
                    tooltip={
                        <>
                            <p>{t('ValuationCard.dc14bc')}</p>
                            <p>{t('ValuationCard.711a9f')}</p>
                        </>
                    }
                />
                <MetricRow
                    label="EPS"
                    value={metrics.epsTTM}
                    description={t('ValuationCard.25e975')}
                    tooltip={
                        <>
                            <p>{t('ValuationCard.fccdcd')}</p>
                            <p>{t('ValuationCard.2276f3')}</p>
                        </>
                    }
                />
            </div>
            {basis !== null && <KrBasisCaption basis={basis} />}
        </section>
    );
}
