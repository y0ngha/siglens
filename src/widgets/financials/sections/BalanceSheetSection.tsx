import { useTranslations } from 'next-intl';
import type { BalanceSheetRow } from '@y0ngha/siglens-core';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import { NetDebtTooltip } from '@/widgets/financials/financialsTooltips';
import { EmptySectionCard } from './EmptySectionCard';
import { StatementTable } from './StatementTable';
import {
    DEFAULT_STATEMENT_CURRENCY,
    type StatementCurrency,
} from '../utils/numberFormat';
import { FinancialTrendChart } from './FinancialTrendChart';
import { toDisplayOrder } from './toDisplayOrder';
import { HEADING_CLASS_NAME } from './constants';

interface BalanceSheetSectionProps {
    rows: BalanceSheetRow[];
    /** 금액 표기에 적용할 통화. 생략하면 USD — 미국 종목의 기존 동작. */
    currency?: StatementCurrency;
}

const HEADING_ID = 'balance-sheet-heading';
/** `widgets.financials.section` 키 — 표시는 렌더 쪽에서 `t()`로. */
const TITLE_KEY = 'balanceSheet';

/**
 * Displays balance sheet data: assets/liabilities/equity trend chart,
 * followed by a full metric table.
 *
 * `rows` are newest→oldest (index 0 = latest). Display is oldest→newest
 * left-to-right.
 */
export function BalanceSheetSection({
    rows,
    currency = DEFAULT_STATEMENT_CURRENCY,
}: BalanceSheetSectionProps) {
    const t = useTranslations('widgets.financials');
    const tSection = useTranslations('widgets.financials.section');
    if (rows.length === 0) {
        return <EmptySectionCard title={tSection(TITLE_KEY)} />;
    }

    const displayRows = toDisplayOrder(rows);
    const columns = displayRows.map(r => r.fiscalYear);

    const chartSeries = [
        {
            labelKo: t('BalanceSheetSection.7c44f5'),
            values: displayRows.map(r => r.totalAssets),
            color: 'bullish' as const,
        },
        {
            labelKo: t('BalanceSheetSection.88bf5b'),
            values: displayRows.map(r => r.totalLiabilities),
            color: 'bearish' as const,
        },
        {
            labelKo: t('BalanceSheetSection.72fc67'),
            values: displayRows.map(r => r.totalStockholdersEquity),
            color: 'neutral' as const,
        },
    ];

    const tableRows = [
        {
            labelKo: t('BalanceSheetSection.7c44f5'),
            values: displayRows.map(r => r.totalAssets),
            format: 'usd' as const,
            colorize: false, // absolute magnitude — larger is neither good nor bad
        },
        {
            labelKo: t('BalanceSheetSection.88bf5b'),
            values: displayRows.map(r => r.totalLiabilities),
            format: 'usd' as const,
            colorize: false, // absolute magnitude — size alone does not signal direction
        },
        {
            labelKo: t('BalanceSheetSection.5d4837'),
            tooltip: <InfoTooltip>{NetDebtTooltip}</InfoTooltip>,
            values: displayRows.map(r => r.netDebt),
            format: 'usd' as const,
            // net debt sign is inverted vs the success/danger convention (negative = net cash = good), so render neutral
            colorize: false,
        },
        {
            labelKo: t('BalanceSheetSection.610240'),
            values: displayRows.map(r => r.cashAndShortTermInvestments),
            format: 'usd' as const,
            colorize: false, // absolute stock — always positive, magnitude ≠ direction signal
        },
        {
            labelKo: t('BalanceSheetSection.72fc67'),
            values: displayRows.map(r => r.totalStockholdersEquity),
            format: 'usd' as const,
            colorize: false, // absolute magnitude — larger equity not inherently good or bad
        },
        {
            labelKo: t('BalanceSheetSection.835374'),
            values: displayRows.map(r => r.currentRatio),
            format: 'num' as const,
            // colorize: true (default) — higher current ratio = better liquidity
        },
    ];

    return (
        <section
            aria-labelledby={HEADING_ID}
            className="rounded-xl border border-secondary-700 bg-secondary-800 p-6"
        >
            <h2 id={HEADING_ID} className={HEADING_CLASS_NAME}>
                {tSection(TITLE_KEY)}
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
