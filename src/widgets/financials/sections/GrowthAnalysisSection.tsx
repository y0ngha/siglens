import { useTranslations } from 'next-intl';
import type { FinancialGrowthRow } from '@y0ngha/siglens-core';
import { EmptySectionCard } from './EmptySectionCard';
import { StatementTable } from './StatementTable';
import { toDisplayOrder } from './toDisplayOrder';
import { HEADING_CLASS_NAME } from './constants';

interface GrowthAnalysisSectionProps {
    rows: FinancialGrowthRow[];
}

const HEADING_ID = 'growth-analysis-heading';
const TITLE = '성장 분석';

/**
 * Convert a YoY growth fraction (e.g. 0.5) to a display percentage (50.0).
 *
 * `StatementTable format: 'pct'` formats as `value.toFixed(1) + '%'`, so the
 * fraction must be multiplied by 100 before being handed to the table. Null
 * propagates unchanged (no data for that period).
 */
function toPercent(v: number | null): number | null {
    return v !== null ? v * 100 : null;
}

/**
 * Displays financial growth rates as a formatted table.
 *
 * YoY growth rates (fractions, e.g. 0.2 = +20%) are formatted as percentages.
 * The latest row's 3Y/5Y/10Y per-share revenue growth is appended at the bottom.
 *
 * `rows` are newest→oldest (index 0 = latest). Display is oldest→newest
 * left-to-right.
 *
 * Per-share multi-year growth is taken from `rows[0]` (the latest data point)
 * and shown as single-column rows for context.
 */
export function GrowthAnalysisSection({ rows }: GrowthAnalysisSectionProps) {
    const t = useTranslations('widgets.financials');
    if (rows.length === 0) {
        return <EmptySectionCard title={TITLE} />;
    }

    const displayRows = toDisplayOrder(rows);
    const columns = displayRows.map(r => r.fiscalYear);

    const yoyRows = [
        {
            labelKo: t('GrowthAnalysisSection.8a595b'),
            values: displayRows.map(r => toPercent(r.revenueGrowth)),
            format: 'pct' as const,
        },
        {
            labelKo: t('GrowthAnalysisSection.5ee2d9'),
            values: displayRows.map(r => toPercent(r.netIncomeGrowth)),
            format: 'pct' as const,
        },
        {
            labelKo: t('GrowthAnalysisSection.35f2dc'),
            values: displayRows.map(r => toPercent(r.epsGrowth)),
            format: 'pct' as const,
        },
        {
            labelKo: t('GrowthAnalysisSection.dd9f11'),
            values: displayRows.map(r => toPercent(r.freeCashFlowGrowth)),
            format: 'pct' as const,
        },
    ];

    const latest = rows[0];
    const perShareRows = [
        {
            labelKo: t('GrowthAnalysisSection.c0a3ad'),
            values: [toPercent(latest.threeYRevenueGrowthPerShare)],
            format: 'pct' as const,
        },
        {
            labelKo: t('GrowthAnalysisSection.18de8f'),
            values: [toPercent(latest.fiveYRevenueGrowthPerShare)],
            format: 'pct' as const,
        },
        {
            labelKo: t('GrowthAnalysisSection.960ca9'),
            values: [toPercent(latest.tenYRevenueGrowthPerShare)],
            format: 'pct' as const,
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
                <StatementTable columns={columns} rows={yoyRows} />
            </div>
            <div className="border-t border-secondary-700/50 pt-4">
                <p className="mb-3 text-xs tracking-wide text-secondary-400 uppercase">
                    {t('GrowthAnalysisSection.fc30d8')}
                </p>
                <StatementTable
                    columns={[latest.fiscalYear]}
                    rows={perShareRows}
                />
            </div>
        </section>
    );
}
