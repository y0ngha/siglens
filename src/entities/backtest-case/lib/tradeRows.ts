import type { BacktestTrade } from '@y0ngha/siglens-core';
import { exitPathOf } from '@/entities/backtest-case/lib/exitPath';
import { tradeKey } from '@/entities/backtest-case/lib/tradeKey';
import type { BacktestTradeRowModel } from '@/entities/backtest-case/model';

/** 매매 목록 → 화면 행 모델. 키와 청산 경로를 한 번만 계산한다. */
export function toTradeRows(
    trades: readonly BacktestTrade[]
): BacktestTradeRowModel[] {
    return trades.map(trade => ({
        key: tradeKey(trade),
        ticker: trade.ticker,
        entryDate: trade.entryDate,
        exitPath: exitPathOf(trade),
        trade,
    }));
}
