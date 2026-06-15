import type { CashFlowRow } from '@y0ngha/siglens-core';
import { EmptySectionCard } from './EmptySectionCard';
import { StatementTable } from './StatementTable';
import { FinancialTrendChart } from './FinancialTrendChart';

interface CashFlowSectionProps {
    rows: CashFlowRow[];
}

const HEADING_ID = 'cash-flow-heading';
const HEADING_CLASS_NAME = 'mb-4 text-lg font-semibold tracking-tight';
const TITLE = '현금흐름표';

/**
 * Displays cash flow statement data: operating CF / FCF / CapEx trend chart,
 * followed by a full metric table.
 *
 * `rows` are newest→oldest (index 0 = latest). Display is oldest→newest
 * left-to-right.
 *
 * CapEx is typically negative in the raw data; it renders with bearish
 * coloring when negative via StatementTable's value-based coloring.
 */
export function CashFlowSection({ rows }: CashFlowSectionProps) {
    if (rows.length === 0) {
        return <EmptySectionCard title={TITLE} />;
    }

    const displayRows = [...rows].reverse();
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
            values: displayRows.map(r => r.capitalExpenditure),
            format: 'usd' as const,
        },
        {
            labelKo: 'FCF',
            values: displayRows.map(r => r.freeCashFlow),
            format: 'usd' as const,
        },
        {
            labelKo: 'FCF마진',
            values: displayRows.map(r => r.fcfMargin),
            format: 'pct' as const,
        },
        {
            labelKo: '배당',
            values: displayRows.map(r => r.dividendsPaid),
            format: 'usd' as const,
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
