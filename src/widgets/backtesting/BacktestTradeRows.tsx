import type { BacktestTradeRowModel } from '@/entities/backtest-case/model';
import { BacktestTradeRow } from './BacktestTradeRow';
import { cardAttrs, UNFILTERED_TOKEN } from './utils/caseListVisibility';

interface BacktestTradeRowsProps {
    rows: readonly BacktestTradeRowModel[];
}

/**
 * 한 달치 매매 행. 서버 목록(`BacktestTradeList`)과 펼칠 때 그리는 월(`TradeDetailsHost`)이 같은
 * 마크업을 쓰도록 래퍼(탭 가시성 토큰·행 표식)까지 여기서 만든다.
 */
export function BacktestTradeRows({ rows }: BacktestTradeRowsProps) {
    return rows.map(row => (
        <div key={row.key} {...cardAttrs([UNFILTERED_TOKEN, row.ticker])}>
            <BacktestTradeRow row={row} />
        </div>
    ));
}
