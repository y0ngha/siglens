/**
 * 재무상태표 섹션 — 자산·부채·자본 추세 차트와 전체 지표 표.
 */
import { useTranslations } from 'next-intl';
import type { BalanceSheetRow } from '@y0ngha/siglens-core';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import { NetDebtTooltip } from '../financialsTooltips';
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

interface BalanceSheetSectionProps {
    rows: BalanceSheetRow[];
    /** 금액 표기에 적용할 통화. 생략하면 USD — 미국 종목의 기본 동작. */
    currency?: StatementCurrency;
}

const HEADING_ID = 'balance-sheet-heading';
/** `widgets.financials.section` 키 — 표시는 렌더 쪽에서 `t()`로. */
const TITLE_KEY = 'balanceSheet';

/**
 * 재무상태표 데이터를 보여 준다: 자산·부채·자본 추세 차트와 전체 지표 표.
 *
 * `rows`는 최신→과거(index 0 = 최신)이고, 화면은 과거→최신(좌→우)으로 그린다.
 */
export function BalanceSheetSection({
    rows,
    currency = DEFAULT_STATEMENT_CURRENCY,
}: BalanceSheetSectionProps) {
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
