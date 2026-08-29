import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { FundamentalValuationMetrics } from '@y0ngha/siglens-core';
import { EmptySectionCard } from './EmptySectionCard';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { cn } from '@/shared/lib/cn';

// 소수 자릿수(digits)가 행마다 달라 단일 상수로 고정할 수 없다. 자릿수별로
// 포매터를 한 번만 만들어 재사용한다 — 렌더마다 new Intl.NumberFormat 금지.
const DECIMAL_FORMATTERS = new Map<number, Intl.NumberFormat>();

function formatDecimal(value: number, digits: number): string {
    let formatter = DECIMAL_FORMATTERS.get(digits);
    if (formatter === undefined) {
        formatter = new Intl.NumberFormat('ko-KR', {
            maximumFractionDigits: digits,
        });
        DECIMAL_FORMATTERS.set(digits, formatter);
    }
    return formatter.format(value);
}

const HEADING_ID = 'valuation-heading';
const HEADING_CLASS_NAME = cn('mb-4', HEADING_SECTION);

interface ValuationCardProps {
    metrics: FundamentalValuationMetrics | null;
}

interface MetricRowProps {
    label: string;
    value: number | null;
    description: string;
    digits?: number;
    tooltip?: ReactNode;
}

function MetricRow({
    label,
    value,
    description,
    digits = 2,
    tooltip,
}: MetricRowProps) {
    const formatted = value !== null ? formatDecimal(value, digits) : '—';

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

export function ValuationCard({ metrics }: ValuationCardProps) {
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
            className="rounded-lg border border-secondary-700 bg-secondary-800 p-6"
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
        </section>
    );
}
