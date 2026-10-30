/**
 * 미래 방향 카드의 목표 주가 섹션(컨센서스 그리드 + 기간별 평균 요약).
 */
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type {
    FundamentalPriceTargetConsensusInput,
    FundamentalPriceTargetSummaryInput,
} from '@y0ngha/siglens-core';
import type { Locale } from '@/shared/i18n/locales';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { formatMoney } from '@/widgets/fundamental/utils/moneyFormat';

interface PriceTargetSectionProps {
    consensus: FundamentalPriceTargetConsensusInput | null;
    summary: FundamentalPriceTargetSummaryInput | null;
    symbol: string;
    locale: Locale;
}

interface PriceTargetEntry {
    label: string;
    value: number | null;
    tooltip?: ReactNode;
}

/**
 * 컨센서스와 요약은 서로 독립이다 — 한쪽만 있어도 그 행만 그린다. 둘 다 없으면 호출부가
 * 섹션 자체를 걸러 낸다.
 */
export function PriceTargetSection({
    consensus,
    summary,
    symbol,
    locale,
}: PriceTargetSectionProps) {
    const t = useTranslations('widgets.fundamental');

    const consensusEntries: PriceTargetEntry[] =
        consensus === null
            ? []
            : [
                  {
                      label: t('FutureDirectionCard.b84f07'),
                      value: consensus.targetLow,
                  },
                  {
                      label: t('FutureDirectionCard.7e0ea3'),
                      value: consensus.targetMedian,
                  },
                  {
                      label: t('FutureDirectionCard.a06069'),
                      value: consensus.targetConsensus,
                      tooltip: (
                          <>
                              <p>{t('FutureDirectionCard.2d8af0')}</p>
                              <p>{t('FutureDirectionCard.0b21ed')}</p>
                          </>
                      ),
                  },
                  {
                      label: t('FutureDirectionCard.5f23f6'),
                      value: consensus.targetHigh,
                  },
              ];

    const summaryEntries: PriceTargetEntry[] =
        summary === null
            ? []
            : [
                  {
                      label: t('FutureDirectionCard.c1648d'),
                      value: summary.lastMonth.avgPriceTarget,
                  },
                  {
                      label: t('FutureDirectionCard.f7b7b3'),
                      value: summary.lastQuarter.avgPriceTarget,
                  },
                  {
                      label: t('FutureDirectionCard.49aace'),
                      value: summary.lastYear.avgPriceTarget,
                  },
              ];

    return (
        <div className="mb-5">
            <h3 className={cn('mb-2', HEADING_SUBSECTION)}>
                {t('FutureDirectionCard.dbfbf1')}
            </h3>
            {consensus !== null && (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
                    {consensusEntries.map(({ label, value, tooltip }) => (
                        <div key={label}>
                            <dt className="text-xs text-secondary-400">
                                {label}
                                {tooltip !== undefined && (
                                    <InfoTooltip>{tooltip}</InfoTooltip>
                                )}
                            </dt>
                            <dd className="font-mono text-sm font-medium tabular-nums">
                                {formatMoney(value, symbol, locale)}
                            </dd>
                        </div>
                    ))}
                </dl>
            )}
            {summary !== null && (
                <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                    {summaryEntries.map(({ label, value }) => (
                        <div key={label} className="flex gap-1">
                            <dt className="text-secondary-400">{label}</dt>
                            <dd className="font-mono">
                                {formatMoney(value, symbol, locale)}
                            </dd>
                        </div>
                    ))}
                </dl>
            )}
        </div>
    );
}
