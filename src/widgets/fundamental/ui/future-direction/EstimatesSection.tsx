/**
 * 미래 방향 카드의 애널리스트 추정치 섹션(EPS·매출).
 */
import { useTranslations } from 'next-intl';
import type { FundamentalAnalystEstimateInput } from '@y0ngha/siglens-core';
import type { Locale } from '@/shared/i18n/locales';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import { cn } from '@/shared/lib/cn';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import {
    formatBigMoney,
    formatMoney,
} from '@/widgets/fundamental/utils/moneyFormat';

interface EstimatesSectionProps {
    estimates: FundamentalAnalystEstimateInput;
    symbol: string;
    locale: Locale;
}

/** 예상 EPS와 예상 매출을 두 칸 그리드로 보여 준다. */
export function EstimatesSection({
    estimates,
    symbol,
    locale,
}: EstimatesSectionProps) {
    const t = useTranslations('widgets.fundamental');
    return (
        <div className="mb-5">
            <h3 className={cn('mb-2', HEADING_SUBSECTION)}>
                {t('FutureDirectionCard.dba802')}
            </h3>
            <dl className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-secondary-800/40 px-4 py-3">
                    <dt className="text-xs text-secondary-400">
                        {t('FutureDirectionCard.bd4c6d')}
                        <InfoTooltip>
                            <p>{t('FutureDirectionCard.b21bb3')}</p>
                            <p>{t('FutureDirectionCard.973dba')}</p>
                        </InfoTooltip>
                    </dt>
                    <dd className="mt-1 font-mono text-lg font-semibold tabular-nums">
                        {formatMoney(estimates.estimatedEpsAvg, symbol, locale)}
                    </dd>
                </div>
                <div className="rounded-lg bg-secondary-800/40 px-4 py-3">
                    <dt className="text-xs text-secondary-400">
                        {t('FutureDirectionCard.69de00')}
                        <InfoTooltip>
                            <p>{t('FutureDirectionCard.f23e65')}</p>
                            <p>{t('FutureDirectionCard.dea4fe')}</p>
                        </InfoTooltip>
                    </dt>
                    <dd className="mt-1 font-mono text-lg font-semibold tabular-nums">
                        {formatBigMoney(
                            estimates.estimatedRevenueAvg,
                            symbol,
                            locale
                        )}
                    </dd>
                </div>
            </dl>
        </div>
    );
}
