import { useTranslations } from 'next-intl';
import type {
    InsiderTransaction,
    InvestorFlowsScorecard,
} from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { cn } from '@/shared/lib/cn';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { FlowTooltip } from '../investorFlowsTooltips';
import { formatInteger } from '../utils/flowFormat';
import { buildInsiderTable } from '../utils/insider';
import { InsiderSummaryCards } from './InsiderSummaryCards';
import { InsiderTradeList } from './InsiderTradeList';

const HEADING_ID = 'flows-insider-heading';

interface InsiderSectionProps {
    readonly transactions: readonly InsiderTransaction[];
    readonly scorecard: InvestorFlowsScorecard;
}

/**
 * 내부자 거래(Form 4) 섹션 — 최근 90일 순매수/순매도 요약, 클러스터 매수 배지, 거래 목록.
 * 요약은 core 점수표(`insider.metrics`, 창 길이는 `freshness.insiderWindow`)를 그대로 쓴다. 데이터가 없으면 "데이터 없음".
 */
export function InsiderSection({
    transactions,
    scorecard,
}: InsiderSectionProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    const metrics = scorecard.insider.metrics;
    const window = scorecard.freshness.insiderWindow;

    return (
        <section
            aria-labelledby={HEADING_ID}
            className={cn(SURFACE_CARD, 'space-y-5 p-6')}
        >
            <div>
                <h2 id={HEADING_ID} className={HEADING_SECTION}>
                    {t('insider.title')}
                    <FlowTooltip term="form4" />
                </h2>
                {window.from !== null && window.to !== null && (
                    <p className="mt-1 text-xs text-secondary-400">
                        {t('insider.window', {
                            days: formatInteger(window.days, locale),
                            from: window.from,
                            to: window.to,
                        })}
                    </p>
                )}
            </div>

            {transactions.length === 0 ? (
                <p className="text-sm text-secondary-300">
                    {t('insider.noData')}
                </p>
            ) : (
                <>
                    {metrics === null ? (
                        <p className="text-sm text-secondary-300">
                            {t('insider.noRecent', {
                                days: formatInteger(window.days, locale),
                            })}
                        </p>
                    ) : (
                        <InsiderSummaryCards metrics={metrics} />
                    )}
                    <InsiderTradeList table={buildInsiderTable(transactions)} />
                </>
            )}
        </section>
    );
}
