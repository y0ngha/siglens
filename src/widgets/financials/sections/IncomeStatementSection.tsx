import { useTranslations } from 'next-intl';
import type { IncomeStatementRow } from '@y0ngha/siglens-core';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import { GrossMarginTooltip } from '@/widgets/financials/financialsTooltips';
import { EmptySectionCard } from './EmptySectionCard';
import { StatementTable } from './StatementTable';
import {
    DEFAULT_STATEMENT_CURRENCY,
    type StatementCurrency,
} from '../utils/numberFormat';
import { FinancialTrendChart } from './FinancialTrendChart';
import { toDisplayOrder } from './toDisplayOrder';
import { HEADING_CLASS_NAME } from './constants';

interface IncomeStatementSectionProps {
    rows: IncomeStatementRow[];
    /** 금액 표기에 적용할 통화. 생략하면 USD — 미국 종목의 기존 동작. */
    currency?: StatementCurrency;
}

const HEADING_ID = 'income-statement-heading';
/** `widgets.financials.section` 키 — 표시는 렌더 쪽에서 `t()`로. */
const TITLE_KEY = 'incomeStatement';

/**
 * Displays income statement data: revenue + net income trend chart,
 * followed by a full metric table.
 *
 * `rows` are newest→oldest (index 0 = latest). Display is oldest→newest
 * left-to-right (reversed for columns and chart values).
 */
export function IncomeStatementSection({
    rows,
    currency = DEFAULT_STATEMENT_CURRENCY,
}: IncomeStatementSectionProps) {
    const t = useTranslations('widgets.financials');
    const tSection = useTranslations('widgets.financials.section');
    if (rows.length === 0) {
        return <EmptySectionCard title={tSection(TITLE_KEY)} />;
    }

    const displayRows = toDisplayOrder(rows);
    const columns = displayRows.map(r => r.fiscalYear);

    const chartSeries = [
        {
            labelKo: t('IncomeStatementSection.191145'),
            values: displayRows.map(r => r.revenue),
            color: 'bullish' as const,
        },
        {
            labelKo: t('IncomeStatementSection.1f56bb'),
            values: displayRows.map(r => r.netIncome),
            color: 'neutral' as const,
        },
    ];

    const tableRows = [
        {
            labelKo: t('IncomeStatementSection.191145'),
            values: displayRows.map(r => r.revenue),
            format: 'usd' as const,
            colorize: false, // absolute magnitude — larger is not inherently good (cf. BalanceSheetSection)
        },
        {
            labelKo: t('IncomeStatementSection.c8e7f2'),
            values: displayRows.map(r => r.grossProfit),
            format: 'usd' as const,
            colorize: false, // absolute magnitude — larger is not inherently good (cf. BalanceSheetSection)
        },
        {
            labelKo: t('IncomeStatementSection.2d311b'),
            values: displayRows.map(r => r.operatingIncome),
            format: 'usd' as const,
        },
        {
            labelKo: t('IncomeStatementSection.1f56bb'),
            values: displayRows.map(r => r.netIncome),
            format: 'usd' as const,
        },
        {
            labelKo: 'EPS',
            values: displayRows.map(r => r.eps),
            format: 'num' as const,
        },
        {
            labelKo: t('IncomeStatementSection.6ae05d'),
            tooltip: <InfoTooltip>{GrossMarginTooltip}</InfoTooltip>,
            values: displayRows.map(r => r.grossMargin),
            format: 'pct' as const,
        },
        {
            labelKo: t('IncomeStatementSection.c62afe'),
            values: displayRows.map(r => r.operatingMargin),
            format: 'pct' as const,
        },
        {
            labelKo: t('IncomeStatementSection.d1ca4f'),
            values: displayRows.map(r => r.netMargin),
            format: 'pct' as const,
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
