import type { BacktestTrade } from '@y0ngha/siglens-core';

/**
 * 매매 한 건의 식별자. 한 종목은 포지션을 하나씩만 들므로 종목 + 매수일이면 유일하다 —
 * `validateBacktestRunData`가 경계에서 이 유일성을 확인한다. 서버 행(`data-trade-detail`)과
 * 클라이언트 상세 조회가 같은 함수로 키를 만든다.
 */
export function tradeKey(
    trade: Pick<BacktestTrade, 'ticker' | 'entryDate'>
): string {
    return `${trade.ticker}|${trade.entryDate}`;
}
