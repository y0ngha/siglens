import type { CashFlowRow } from '@y0ngha/siglens-core';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import {
    CapExTooltip,
    FcfTooltip,
    FcfMarginTooltip,
} from '@/widgets/financials/financialsTooltips';
import { EmptySectionCard } from './EmptySectionCard';
import { StatementTable } from './StatementTable';
import {
    DEFAULT_STATEMENT_CURRENCY,
    type StatementCurrency,
} from '../utils/numberFormat';
import { FinancialTrendChart } from './FinancialTrendChart';
import { toDisplayOrder } from './toDisplayOrder';
import { HEADING_CLASS_NAME } from './constants';

interface CashFlowSectionProps {
    rows: CashFlowRow[];
    /** 금액 표기에 적용할 통화. 생략하면 USD — 미국 종목의 기존 동작. */
    currency?: StatementCurrency;
}

const HEADING_ID = 'cash-flow-heading';
const TITLE = '현금흐름표';

/**
 * Displays cash flow statement data: operating CF / FCF / CapEx trend chart,
 * followed by a full metric table.
 *
 * `rows` are newest→oldest (index 0 = latest). Display is oldest→newest
 * left-to-right.
 *
 * CapEx and 배당 are structurally always-negative (capital outflows by
 * definition), so their sign is not a good/bad signal — both rows carry
 * `colorize: false` to suppress StatementTable's value-based red/green
 * coloring. The chart series still uses 'bearish' for CapEx to distinguish
 * it visually from 영업CF and FCF in the trend line.
 */
export function CashFlowSection({
    rows,
    currency = DEFAULT_STATEMENT_CURRENCY,
}: CashFlowSectionProps) {
    if (rows.length === 0) {
        return <EmptySectionCard title={TITLE} />;
    }

    const displayRows = toDisplayOrder(rows);
    const columns = displayRows.map(r => r.fiscalYear);

    const chartSeries = [
        {
            labelKo: '영업CF',
            values: displayRows.map(r => r.operatingCashFlow),
            color: 'bullish' as const,
        },
        {
            labelKo: 'FCF',
            values: displayRows.map(r => r.freeCashFlow),
            color: 'neutral' as const,
        },
        {
            labelKo: 'CapEx',
            values: displayRows.map(r => r.capitalExpenditure),
            color: 'bearish' as const,
        },
    ];

    const tableRows = [
        {
            labelKo: '영업현금흐름',
            values: displayRows.map(r => r.operatingCashFlow),
            format: 'usd' as const,
        },
        {
            labelKo: 'CapEx',
            tooltip: <InfoTooltip>{CapExTooltip}</InfoTooltip>,
            values: displayRows.map(r => r.capitalExpenditure),
            format: 'usd' as const,
            colorize: false, // absolute capital outflow — negative sign is structural, not a signal (same as 배당)
        },
        {
            labelKo: 'FCF',
            tooltip: <InfoTooltip>{FcfTooltip}</InfoTooltip>,
            values: displayRows.map(r => r.freeCashFlow),
            format: 'usd' as const,
        },
        {
            labelKo: 'FCF마진',
            tooltip: <InfoTooltip>{FcfMarginTooltip}</InfoTooltip>,
            values: displayRows.map(r => r.fcfMargin),
            format: 'pct' as const,
        },
        {
            labelKo: '배당',
            values: displayRows.map(r => r.dividendsPaid),
            format: 'usd' as const,
            colorize: false, // absolute cash outflow — negative sign is structural, not a signal
        },
    ];

    return (
        <section
            aria-labelledby={HEADING_ID}
            className="rounded-xl border border-secondary-700 bg-secondary-800 p-6"
        >
            <h2 id={HEADING_ID} className={HEADING_CLASS_NAME}>
                {TITLE}
            </h2>
            <div className="mb-6">
                <FinancialTrendChart
                    series={chartSeries}
                    periods={columns}
                    currency={currency}
                />
            </div>
            <StatementTable
                columns={columns}
                rows={tableRows}
                currency={currency}
            />
        </section>
    );
}
