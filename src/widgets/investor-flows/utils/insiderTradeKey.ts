/**
 * 내부자 거래 행의 React key.
 */
import type { InsiderTransaction } from '@y0ngha/siglens-core';

/** 같은 날 같은 사람이 같은 수량을 여러 번 보고할 수 있어 원문 주소까지 키에 넣는다. */
export function insiderTradeKey(tx: InsiderTransaction): string {
    return `${tx.date}-${tx.name}-${tx.shares}-${tx.url}`;
}
