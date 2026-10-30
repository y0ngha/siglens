import { useTranslations } from 'next-intl';
import type { BacktestCase } from '@y0ngha/siglens-core';
import { formatUsdCurrency } from '@/shared/lib/priceFormat';

interface EntryChipProps {
    case_: BacktestCase;
}

/**
 * 진입 칩(매수·진입일·진입가). 백테스트 신호는 매수뿐이라 배색이 고정이다.
 *
 * 배지 텍스트는 차트 색이 아니라 `ui-*-text`를 쓴다. 차트 색은 캔버스 배경 위에서 고른
 * 값이라 `/10` 틴트 위에 얹으면 라이트 테마에서 대비가 4.5:1 아래로 떨어진다.
 */
export function EntryChip({ case_: c }: EntryChipProps) {
    const t = useTranslations('widgets.backtesting');
    return (
        <div className="shrink-0 rounded border border-chart-bullish/20 bg-chart-bullish/10 px-2 py-1">
            <span className="font-semibold text-ui-success-text">
                {t('BacktestCaseCard.31e4d3')}
            </span>
            <span className="ml-1 text-secondary-400">{c.entryDate}</span>
            <span className="ml-1 font-mono text-secondary-500 tabular-nums">
                {formatUsdCurrency(c.entryPrice)}
            </span>
        </div>
    );
}
