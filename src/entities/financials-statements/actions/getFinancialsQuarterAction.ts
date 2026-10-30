'use server';

import type { FinancialsSnapshot } from '@y0ngha/siglens-core';
import { QUARTER_LIMIT } from '../lib/financialsSnapshot';
import { getFinancialsSnapshot } from '../server/getFinancialsSnapshot';

/** 예기치 않은 fetch 실패 시 반환하는, 모든 섹션이 빈 완전한 스냅샷. */
const EMPTY_SNAPSHOT: FinancialsSnapshot = {
    income: [],
    balance: [],
    cashFlow: [],
    incomeGrowth: [],
    financialGrowth: [],
    cashFlowGrowth: [],
};

/**
 * 분기(quarter) 재무 스냅샷을 요청 시점에 지연 조회하는 Server Action.
 * `useFinancialsPeriod`가 사용자가 분기 보기로 전환할 때 호출한다.
 *
 * `getFinancialsSnapshot`(period='quarter', limit=QUARTER_LIMIT)에 위임하므로 SSR
 * 연간 경로와 같은 cache key·tag 규칙을 공유한다. widgets가 app을 import할 수 없어
 * entities 레이어에 둔다.
 *
 * Server Action은 예외를 클라이언트로 전파하지 않는다(SERVER.md#SA-1). 예기치 않은
 * throw는 로그를 남기고 빈 스냅샷을 반환한다 — `useFinancialsPeriod`의 all-empty
 * 판정이 토글을 연간으로 되돌려 사용자는 500 대신 유효한 SSR 데이터를 계속 본다.
 */
export async function getFinancialsQuarterAction(
    symbol: string
): Promise<FinancialsSnapshot> {
    try {
        return await getFinancialsSnapshot(symbol, 'quarter', QUARTER_LIMIT);
    } catch (error) {
        console.error(
            '[getFinancialsQuarterAction] quarter fetch failed:',
            symbol,
            error
        );
        return EMPTY_SNAPSHOT;
    }
}
