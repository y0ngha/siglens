import { useTranslations } from 'next-intl';
import type { ChatFinancialsBlock } from '@/entities/chat-conversation/types';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { compactMoney, NO_VALUE } from './format';
import type { ChatStatementRow, ChatTrendTableModel } from './reusedBlockTypes';

/**
 * 분기 실적 블록을 펀더멘털 탭의 추세 차트·재무제표 표 입력으로 바꾼다 — 매출·순이익 막대(탭의 손익계산서와 같은 색),
 * 표는 매출·순이익·EPS, 그리고 값이 있을 때만 EPS 예상·실제 행.
 */
export function useFinancialsBlockModel(
    block: ChatFinancialsBlock
): ChatTrendTableModel {
    const t = useTranslations('widgets.chart');
    const locale = useResolvedLocale();
    const { quarters, currency } = block;
    const latest = quarters.at(-1);
    const symbol = block.name ?? block.symbol;
    const revenue = quarters.map(q => q.revenue);
    const netIncome = quarters.map(q => q.netIncome);
    const money = (v: number | null): string =>
        v === null ? NO_VALUE : compactMoney(v, currency, locale);
    const optionalRow = (
        labelKo: string,
        values: (number | null)[]
    ): ChatStatementRow[] =>
        values.some(v => v !== null)
            ? [{ labelKo, values, format: 'perShare', colorize: false }]
            : [];
    return {
        title: t('ChatVisual.financialsTitle', {
            symbol,
            count: quarters.length,
        }),
        ariaLabel: t('ChatVisual.financialsAria', {
            symbol,
            count: quarters.length,
            period: latest?.period ?? NO_VALUE,
            revenue: money(latest?.revenue ?? null),
            netIncome: money(latest?.netIncome ?? null),
        }),
        asOfText: t('ChatVisual.asOf', { date: block.asOf.slice(0, 10) }),
        currency,
        columns: quarters.map(q => q.period),
        series: [
            {
                labelKo: t('ChatVisual.colRevenue'),
                values: revenue,
                color: 'bullish',
            },
            {
                labelKo: t('ChatVisual.colNetIncome'),
                values: netIncome,
                color: 'neutral',
            },
        ],
        rows: [
            {
                labelKo: t('ChatVisual.colRevenue'),
                values: revenue,
                format: 'usd',
                colorize: false,
            },
            {
                labelKo: t('ChatVisual.colNetIncome'),
                values: netIncome,
                format: 'usd',
            },
            {
                labelKo: t('ChatVisual.colEps'),
                values: quarters.map(q => q.eps),
                format: 'perShare',
            },
            ...optionalRow(
                t('ChatVisual.colEpsEstimate'),
                quarters.map(q => q.epsEstimated)
            ),
            ...optionalRow(
                t('ChatVisual.colEpsActual'),
                quarters.map(q => q.epsActual)
            ),
        ],
    };
}
