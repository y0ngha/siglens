/**
 * 현금흐름표 섹션 — 영업CF·FCF·CapEx 추세 차트와 전체 지표 표.
 */
import { useTranslations } from 'next-intl';
import type { CashFlowRow } from '@y0ngha/siglens-core';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import {
    CapExTooltip,
    FcfTooltip,
    FcfMarginTooltip,
} from '../financialsTooltips';
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

interface CashFlowSectionProps {
    rows: CashFlowRow[];
    /** 금액 표기에 적용할 통화. 생략하면 USD — 미국 종목의 기본 동작. */
    currency?: StatementCurrency;
}

const HEADING_ID = 'cash-flow-heading';
/** `widgets.financials.section` 키 — 표시는 렌더 쪽에서 `t()`로. */
const TITLE_KEY = 'cashFlow';

/**
 * 현금흐름표 데이터를 보여 준다: 영업CF·FCF·CapEx 추세 차트와 전체 지표 표.
 *
 * `rows`는 최신→과거(index 0 = 최신)이고, 화면은 과거→최신(좌→우)으로 그린다.
 *
 * CapEx와 배당은 정의상 항상 음수(자본 유출)라 부호가 좋고 나쁨의 신호가 아니다 — 두 행은
 * `colorize: false`로 표의 부호 기반 빨강/초록을 끈다. 차트에서는 CapEx 시리즈만 'bearish'로
 * 선언해 영업CF·FCF와 구분한다. FCF는 'neutral'(파랑)로 선언하며, 음수 기간에도 그 색을
 * 지키고 부호는 baseline 아래 방향으로 읽힌다.
 */
export function CashFlowSection({
    rows,
    currency = DEFAULT_STATEMENT_CURRENCY,
}: CashFlowSectionProps) {
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
            labelKo: t('CashFlowSection.461536'),
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
            labelKo: t('CashFlowSection.16b9ae'),
            values: displayRows.map(r => r.operatingCashFlow),
            format: 'usd' as const,
        },
        {
            labelKo: 'CapEx',
            tooltip: <InfoTooltip>{CapExTooltip}</InfoTooltip>,
            values: displayRows.map(r => r.capitalExpenditure),
            format: 'usd' as const,
            colorize: false, // absolute capital outflow — negative sign is structural, not a signal (same as 배당)
        },
        {
            labelKo: 'FCF',
            tooltip: <InfoTooltip>{FcfTooltip}</InfoTooltip>,
            values: displayRows.map(r => r.freeCashFlow),
            format: 'usd' as const,
        },
        {
            labelKo: t('CashFlowSection.3aa41a'),
            tooltip: <InfoTooltip>{FcfMarginTooltip}</InfoTooltip>,
            values: displayRows.map(r => r.fcfMargin),
            format: 'pct' as const,
        },
        {
            labelKo: t('CashFlowSection.98287f'),
            values: displayRows.map(r => r.dividendsPaid),
            format: 'usd' as const,
            colorize: false, // absolute cash outflow — negative sign is structural, not a signal
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
