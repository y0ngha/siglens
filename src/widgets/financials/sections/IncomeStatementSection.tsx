/**
 * 손익계산서 섹션 — 매출·순이익 추세 차트와 전체 지표 표.
 */
import { useTranslations } from 'next-intl';
import type { IncomeStatementRow } from '@y0ngha/siglens-core';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import { GrossMarginTooltip } from '../financialsTooltips';
import { EmptySectionCard } from '@/shared/ui/EmptySectionCard';
import { StatementSectionFrame } from '../ui/statement-section/StatementSectionFrame';
import { TrendAndTable } from './TrendAndTable';
import {
    DEFAULT_STATEMENT_CURRENCY,
    type StatementCurrency,
} from '../utils/statementCurrency';
import { toDisplayOrder } from '../utils/toDisplayOrder';
import { HEADING_CLASS_NAME } from '../utils/sectionHeading';
import { statementColumnLabel } from '../utils/statementColumnLabel';

interface IncomeStatementSectionProps {
    rows: IncomeStatementRow[];
    /** 금액 표기에 적용할 통화. 생략하면 USD — 미국 종목의 기본 동작. */
    currency?: StatementCurrency;
}

const HEADING_ID = 'income-statement-heading';
/** `widgets.financials.section` 키 — 표시는 렌더 쪽에서 `t()`로. */
const TITLE_KEY = 'incomeStatement';

/**
 * 손익계산서 데이터를 보여 준다: 매출·순이익 추세 차트와 전체 지표 표.
 *
 * `rows`는 최신→과거(index 0 = 최신)이고, 화면은 과거→최신(좌→우)으로 뒤집어 그린다.
 */
export function IncomeStatementSection({
    rows,
    currency = DEFAULT_STATEMENT_CURRENCY,
}: IncomeStatementSectionProps) {
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
            format: 'perShare' as const,
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
        <StatementSectionFrame
            headingId={HEADING_ID}
            title={tSection(TITLE_KEY)}
        >
            <TrendAndTable
                caption={tSection(TITLE_KEY)}
                columns={columns}
                series={chartSeries}
                rows={tableRows}
                currency={currency}
            />
        </StatementSectionFrame>
    );
}
