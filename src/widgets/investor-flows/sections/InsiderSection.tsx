import { useTranslations } from 'next-intl';
import type {
    InsiderMetrics,
    InsiderTransaction,
    InvestorFlowsScorecard,
    InvestorFlowsWindow,
    ProposedSale,
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
import { ProposedSalesBlock } from './ProposedSalesBlock';

const HEADING_ID = 'flows-insider-heading';

interface InsiderSectionProps {
    readonly transactions: readonly InsiderTransaction[];
    /** Form 144. `undefined` = 이 원천이 스냅샷에 없다(조회 실패). */
    readonly proposedSales: readonly ProposedSale[] | undefined;
    /** Form 144 수집이 최근까지 따라잡지 못했다(구간이 비어 있을 때만 참). */
    readonly proposedSalesCollecting: boolean;
    readonly scorecard: InvestorFlowsScorecard;
}

interface InsiderBodyProps {
    readonly transactions: readonly InsiderTransaction[];
    readonly metrics: InsiderMetrics | null;
    readonly scoringWindow: InvestorFlowsWindow;
}

/** 데이터 없음 → 최근 창 거래 없음 → 요약 카드 + 거래 목록 순으로 첫 해당 분기만 그린다. */
function InsiderBody({
    transactions,
    metrics,
    scoringWindow,
}: InsiderBodyProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    if (transactions.length === 0) {
        return (
            <p className="text-sm text-secondary-300">{t('insider.noData')}</p>
        );
    }
    return (
        <>
            {metrics === null ? (
                <p className="text-sm text-secondary-300">
                    {t('insider.noRecent', {
                        days: formatInteger(scoringWindow.days, locale),
                    })}
                </p>
            ) : (
                <InsiderSummaryCards metrics={metrics} />
            )}
            <InsiderTradeList
                table={buildInsiderTable(transactions, scoringWindow)}
                scoringWindow={scoringWindow}
            />
        </>
    );
}

/**
 * 내부자 거래 섹션 — 최근 90일 순매수/순매도 요약, 클러스터 매수 배지, 거래 목록(Form 4), 그 아래 매도 예정 신고(Form 144).
 * 요약은 core 점수표(`insider.metrics`, 창 길이는 `freshness.insiderWindow`)를 그대로 쓴다. 데이터가 없으면 "데이터 없음".
 */
export function InsiderSection({
    transactions,
    proposedSales,
    proposedSalesCollecting,
    scorecard,
}: InsiderSectionProps) {
    const t = useTranslations('widgets.investor-flows');
    const locale = useResolvedLocale();
    const metrics = scorecard.insider.metrics;
    const insiderWindow = scorecard.freshness.insiderWindow;

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
                {insiderWindow.from !== null && insiderWindow.to !== null && (
                    <p className="mt-1 text-xs text-secondary-400">
                        {t('insider.window', {
                            days: formatInteger(insiderWindow.days, locale),
                            from: insiderWindow.from,
                            to: insiderWindow.to,
                        })}
                    </p>
                )}
            </div>

            <InsiderBody
                transactions={transactions}
                metrics={metrics}
                scoringWindow={insiderWindow}
            />
            <ProposedSalesBlock
                sales={proposedSales}
                collecting={proposedSalesCollecting}
            />
        </section>
    );
}
