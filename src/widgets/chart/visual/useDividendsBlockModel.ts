import { useTranslations } from 'next-intl';
import type { ChatDividendsBlock } from '@/entities/chat-conversation/types';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { plainMoney } from './format';
import type { ChatTrendTableModel } from './reusedBlockTypes';

/**
 * 연도별 배당 블록을 재무 추세 차트·재무제표 표 입력으로 바꾼다 — 주당 배당 한 시리즈, 올해처럼 아직 다 모이지 않은
 * 해는 열 이름에 "(진행 중)"이 붙는다.
 */
export function useDividendsBlockModel(
    block: ChatDividendsBlock
): ChatTrendTableModel {
    const t = useTranslations('widgets.chart');
    const locale = useResolvedLocale();
    const { years, currency } = block;
    const latest = years.at(-1);
    const amounts = years.map(y => y.amount);
    const symbol = block.name ?? block.symbol;
    const ariaValues = {
        symbol,
        year: latest?.year ?? 0,
        amount:
            latest === undefined
                ? ''
                : plainMoney(latest.amount, currency, locale),
    };
    return {
        title: t('ChatVisual.dividendsTitle', { symbol, currency }),
        ariaLabel:
            latest?.partial === true
                ? t('ChatVisual.dividendsAriaPartial', ariaValues)
                : t('ChatVisual.dividendsAria', ariaValues),
        asOfText: t('ChatVisual.asOf', { date: block.asOf.slice(0, 10) }),
        currency,
        columns: years.map(y =>
            y.partial
                ? t('ChatVisual.yearPartial', { year: y.year })
                : String(y.year)
        ),
        series: [
            {
                labelKo: t('ChatVisual.colDividend'),
                values: amounts,
                color: 'bullish',
            },
        ],
        rows: [
            {
                labelKo: t('ChatVisual.colDividend'),
                values: amounts,
                format: 'perShare',
                colorize: false,
            },
        ],
    };
}
