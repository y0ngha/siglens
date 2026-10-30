/**
 * 성장 분석 섹션 — 전년 대비 성장률 표와 최신 기준 다년 주당 매출 성장률 표.
 */
import { useTranslations } from 'next-intl';
import type { FinancialGrowthRow } from '@y0ngha/siglens-core';
import { EmptySectionCard } from '@/shared/ui/EmptySectionCard';
import { StatementSectionFrame } from '../ui/statement-section/StatementSectionFrame';
import { toPercent } from '../utils/growthFormat';
import { HEADING_CLASS_NAME } from '../utils/sectionHeading';
import { statementColumnLabel } from '../utils/statementColumnLabel';
import { toDisplayOrder } from '../utils/toDisplayOrder';
import { StatementTable } from './StatementTable';

interface GrowthAnalysisSectionProps {
    rows: FinancialGrowthRow[];
}

const HEADING_ID = 'growth-analysis-heading';
/** `widgets.financials.section` 키 — 표시는 렌더 쪽에서 `t()`로. */
const TITLE_KEY = 'growthAnalysis';

/**
 * 성장률을 표로 보여 준다.
 *
 * 전년 대비 성장률(분수, 0.2 = +20%)은 퍼센트로 표기하고, 최신 행(`rows[0]`)의 3·5·10년 주당
 * 매출 성장률은 단일 열 표로 아래에 덧붙인다.
 *
 * `rows`는 최신→과거(index 0 = 최신)이고, 화면은 과거→최신(좌→우)으로 그린다.
 */
export function GrowthAnalysisSection({ rows }: GrowthAnalysisSectionProps) {
    const t = useTranslations('widgets.financials');
    const tSection = useTranslations('widgets.financials.section');
    if (rows.length === 0) {
        return (
            <EmptySectionCard
                headingId={HEADING_ID}
                title={tSection(TITLE_KEY)}
                headingClassName={HEADING_CLASS_NAME}
            />
        );
    }

    const displayRows = toDisplayOrder(rows);
    const columns = displayRows.map(statementColumnLabel);

    const yoyRows = [
        {
            labelKo: t('GrowthAnalysisSection.8a595b'),
            pick: (r: FinancialGrowthRow) => r.revenueGrowth,
        },
        {
            labelKo: t('GrowthAnalysisSection.5ee2d9'),
            pick: (r: FinancialGrowthRow) => r.netIncomeGrowth,
        },
        {
            labelKo: t('GrowthAnalysisSection.35f2dc'),
            pick: (r: FinancialGrowthRow) => r.epsGrowth,
        },
        {
            labelKo: t('GrowthAnalysisSection.dd9f11'),
            pick: (r: FinancialGrowthRow) => r.freeCashFlowGrowth,
        },
    ].map(({ labelKo, pick }) => ({
        labelKo,
        values: displayRows.map(r => toPercent(pick(r))),
        format: 'pct' as const,
    }));

    const latest = rows[0];
    const perShareRows = [
        {
            labelKo: t('GrowthAnalysisSection.c0a3ad'),
            growth: latest.threeYRevenueGrowthPerShare,
        },
        {
            labelKo: t('GrowthAnalysisSection.18de8f'),
            growth: latest.fiveYRevenueGrowthPerShare,
        },
        {
            labelKo: t('GrowthAnalysisSection.960ca9'),
            growth: latest.tenYRevenueGrowthPerShare,
        },
    ].map(({ labelKo, growth }) => ({
        labelKo,
        values: [toPercent(growth)],
        format: 'pct' as const,
    }));

    return (
        <StatementSectionFrame
            headingId={HEADING_ID}
            title={tSection(TITLE_KEY)}
        >
            <div className="mb-6">
                <StatementTable
                    caption={tSection('growthAnalysisYoy')}
                    columns={columns}
                    rows={yoyRows}
                />
            </div>
            <div className="border-t border-secondary-700/50 pt-4">
                <p className="mb-3 text-xs text-secondary-400">
                    {t('GrowthAnalysisSection.fc30d8')}
                </p>
                <StatementTable
                    caption={t('GrowthAnalysisSection.ca84e3')}
                    columns={[statementColumnLabel(latest)]}
                    rows={perShareRows}
                />
            </div>
        </StatementSectionFrame>
    );
}
