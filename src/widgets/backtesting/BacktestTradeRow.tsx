import { useTranslations } from 'next-intl';
import type { BacktestTradeRowModel } from '@/entities/backtest-case/model';
import { formatSignedPercent } from '@/shared/lib/priceFormat';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { TRADE_DETAIL_ATTR } from './utils/tradeDetailsToggle';
import { ENTRY_TYPE_KEY, EXIT_PATH_KEY } from './utils/tradeLabels';

interface BacktestTradeRowProps {
    row: BacktestTradeRowModel;
}

/**
 * 매매 한 건의 접힌 줄. 스타일은 행마다 클래스로 반복하지 않고 목록 컨테이너
 * (`BacktestTradeList`의 `TRADE_ROW_STYLES`)가 `data-trade-row`/`data-col` 선택자로 한 번만
 * 소유한다 — 690행이면 행당 클래스 600바이트가 HTML과 RSC 페이로드에 두 번씩 실렸다.
 * 펼친 본문은 `TradeDetailsHost`가 `data-trade-detail` 자리에 그린다.
 */
export function BacktestTradeRow({ row }: BacktestTradeRowProps) {
    const { trade } = row;
    const t = useTranslations('widgets.backtesting.tradeRow');
    const tPath = useTranslations('widgets.backtesting.exitPath');

    return (
        <details data-trade-row="" className={SURFACE_CARD}>
            <summary>
                <span data-col="ticker" translate="no">
                    {trade.ticker}
                </span>
                <span data-col="entry">
                    {t(ENTRY_TYPE_KEY[trade.entryType])}
                </span>
                <span data-col="period">
                    {t('period', {
                        v0: trade.entryDate,
                        v1: trade.exitDate,
                        v2: trade.holdingDays,
                    })}
                </span>
                <span data-col="path">
                    {tPath(EXIT_PATH_KEY[row.exitPath])}
                </span>
                <span
                    data-col="return"
                    data-sign={trade.returnPct >= 0 ? 'pos' : 'neg'}
                >
                    {formatSignedPercent(trade.returnPct, 2)}
                </span>
            </summary>
            <div {...{ [TRADE_DETAIL_ATTR]: row.key }} />
        </details>
    );
}
