import type { BalanceSheetRow } from '@y0ngha/siglens-core';
import { EmptySectionCard } from './EmptySectionCard';
import { StatementTable } from './StatementTable';
import { FinancialTrendChart } from './FinancialTrendChart';

interface BalanceSheetSectionProps {
    rows: BalanceSheetRow[];
}

const HEADING_ID = 'balance-sheet-heading';
const HEADING_CLASS_NAME = 'mb-4 text-lg font-semibold tracking-tight';
const TITLE = '재무상태표';

/**
 * Displays balance sheet data: assets/liabilities/equity trend chart,
 * followed by a full metric table.
 *
 * `rows` are newest→oldest (index 0 = latest). Display is oldest→newest
 * left-to-right.
 */
export function BalanceSheetSection({ rows }: BalanceSheetSectionProps) {
    if (rows.length === 0) {
        return <EmptySectionCard title={TITLE} />;
    }

    const displayRows = [...rows].reverse();
    const columns = displayRows.map(r => r.fiscalYear);

    const chartSeries = [
        {
            labelKo: '총자산',
            values: displayRows.map(r => r.totalAssets),
            color: 'bullish' as const,
        },
        {
            labelKo: '총부채',
            values: displayRows.map(r => r.totalLiabilities),
            color: 'bearish' as const,
        },
        {
            labelKo: '자본',
            values: displayRows.map(r => r.totalStockholdersEquity),
            color: 'neutral' as const,
        },
    ];

    const tableRows = [
        {
            labelKo: '총자산',
            values: displayRows.map(r => r.totalAssets),
            format: 'usd' as const,
        },
        {
            labelKo: '총부채',
            values: displayRows.map(r => r.totalLiabilities),
            format: 'usd' as const,
        },
        {
            labelKo: '순부채',
            values: displayRows.map(r => r.netDebt),
            format: 'usd' as const,
        },
        {
            labelKo: '현금',
            values: displayRows.map(r => r.cashAndShortTermInvestments),
            format: 'usd' as const,
        },
        {
            labelKo: '자본',
            values: displayRows.map(r => r.totalStockholdersEquity),
            format: 'usd' as const,
        },
        {
            labelKo: '유동비율',
            values: displayRows.map(r => r.currentRatio),
            format: 'num' as const,
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
