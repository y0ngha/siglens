import type { IncomeStatementRow } from '@y0ngha/siglens-core';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import { GrossMarginTooltip } from '@/widgets/financials/financialsTooltips';
import { EmptySectionCard } from './EmptySectionCard';
import { StatementTable } from './StatementTable';
import { FinancialTrendChart } from './FinancialTrendChart';
import { toDisplayOrder } from './toDisplayOrder';
import { HEADING_CLASS_NAME } from './constants';

interface IncomeStatementSectionProps {
    rows: IncomeStatementRow[];
}

const HEADING_ID = 'income-statement-heading';
const TITLE = '손익계산서';

/**
 * Displays income statement data: revenue + net income trend chart,
 * followed by a full metric table.
 *
 * `rows` are newest→oldest (index 0 = latest). Display is oldest→newest
 * left-to-right (reversed for columns and chart values).
 */
export function IncomeStatementSection({ rows }: IncomeStatementSectionProps) {
    if (rows.length === 0) {
        return <EmptySectionCard title={TITLE} />;
    }

    const displayRows = toDisplayOrder(rows);
    const columns = displayRows.map(r => r.fiscalYear);

    const chartSeries = [
        {
            labelKo: '매출',
            values: displayRows.map(r => r.revenue),
            color: 'bullish' as const,
        },
        {
            labelKo: '순이익',
            values: displayRows.map(r => r.netIncome),
            color: 'neutral' as const,
        },
    ];

    const tableRows = [
        {
            labelKo: '매출',
            values: displayRows.map(r => r.revenue),
            format: 'usd' as const,
            colorize: false, // absolute magnitude — larger is not inherently good (cf. BalanceSheetSection)
        },
        {
            labelKo: '매출총이익',
            values: displayRows.map(r => r.grossProfit),
            format: 'usd' as const,
            colorize: false, // absolute magnitude — larger is not inherently good (cf. BalanceSheetSection)
        },
        {
            labelKo: '영업이익',
            values: displayRows.map(r => r.operatingIncome),
            format: 'usd' as const,
        },
        {
            labelKo: '순이익',
            values: displayRows.map(r => r.netIncome),
            format: 'usd' as const,
        },
        {
            labelKo: 'EPS',
            values: displayRows.map(r => r.eps),
            format: 'num' as const,
        },
        {
            labelKo: '매출총이익률',
            tooltip: <InfoTooltip>{GrossMarginTooltip}</InfoTooltip>,
            values: displayRows.map(r => r.grossMargin),
            format: 'pct' as const,
        },
        {
            labelKo: '영업이익률',
            values: displayRows.map(r => r.operatingMargin),
            format: 'pct' as const,
        },
        {
            labelKo: '순이익률',
            values: displayRows.map(r => r.netMargin),
            format: 'pct' as const,
        },
    ];

    return (
        <section
            aria-labelledby={HEADING_ID}
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
        >
            <h2 id={HEADING_ID} className={HEADING_CLASS_NAME}>
                {TITLE}
            </h2>
            <div className="mb-6">
                <FinancialTrendChart series={chartSeries} periods={columns} />
            </div>
            <StatementTable columns={columns} rows={tableRows} />
        </section>
    );
}
