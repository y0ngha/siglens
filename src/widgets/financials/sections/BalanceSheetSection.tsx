import type { BalanceSheetRow } from '@y0ngha/siglens-core';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import { NetDebtTooltip } from '@/widgets/financials/financialsTooltips';
import { EmptySectionCard } from './EmptySectionCard';
import { StatementTable } from './StatementTable';
import { FinancialTrendChart } from './FinancialTrendChart';
import { toDisplayOrder } from './toDisplayOrder';
import { HEADING_CLASS_NAME } from './constants';

interface BalanceSheetSectionProps {
    rows: BalanceSheetRow[];
}

const HEADING_ID = 'balance-sheet-heading';
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

    const displayRows = toDisplayOrder(rows);
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
            colorize: false, // absolute magnitude — larger is neither good nor bad
        },
        {
            labelKo: '총부채',
            values: displayRows.map(r => r.totalLiabilities),
            format: 'usd' as const,
            colorize: false, // absolute magnitude — size alone does not signal direction
        },
        {
            labelKo: '순부채',
            tooltip: <InfoTooltip>{NetDebtTooltip}</InfoTooltip>,
            values: displayRows.map(r => r.netDebt),
            format: 'usd' as const,
            // colorize: true (default) — negative net debt = net cash position (good)
        },
        {
            labelKo: '현금',
            values: displayRows.map(r => r.cashAndShortTermInvestments),
            format: 'usd' as const,
            colorize: false, // absolute stock — always positive, magnitude ≠ direction signal
        },
        {
            labelKo: '자본',
            values: displayRows.map(r => r.totalStockholdersEquity),
            format: 'usd' as const,
            colorize: false, // absolute magnitude — larger equity not inherently good or bad
        },
        {
            labelKo: '유동비율',
            values: displayRows.map(r => r.currentRatio),
            format: 'num' as const,
            // colorize: true (default) — higher current ratio = better liquidity
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
