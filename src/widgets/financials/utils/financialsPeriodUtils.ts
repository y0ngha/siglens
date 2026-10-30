/**
 * 분기 재무제표 지연 조회 — 훅이 상태 setter를 컨텍스트로 넘기고 결과 반영만 맡긴다.
 */
import type { FinancialsSnapshot, StatementPeriod } from '@y0ngha/siglens-core';
import { getFinancialsQuarterAction } from '@/entities/financials-statements/actions/getFinancialsQuarterAction';

/**
 * 스냅샷의 어느 섹션에도 재무제표 데이터가 없으면 `true`.
 *
 * `getFinancialsQuarterAction`은 `CachedFinancialStatementsProvider`가 FMP 예외를 삼키고
 * `[]`를 돌려주므로, 실패한 조회가 reject가 아니라 전부 빈 스냅샷으로 **resolve**된다. 이를
 * reject와 같은 소프트 실패로 보고 연간으로 되돌려야 빈 섹션 카드만 가득한 화면을 피한다.
 */
function isEmptySnapshot(snapshot: FinancialsSnapshot): boolean {
    return (
        snapshot.income.length === 0 &&
        snapshot.balance.length === 0 &&
        snapshot.cashFlow.length === 0
    );
}

/** 분기 조회 결과를 반영하는 setter 묶음. */
export interface FetchQuarterContext {
    setPeriodState: (p: StatementPeriod) => void;
    setQuarterSnapshot: (s: FinancialsSnapshot) => void;
    setIsLoading: (v: boolean) => void;
    /** 분기 데이터를 못 가져왔음을 알린다 — 화면이 짧은 안내를 보여 주는 근거다. */
    setQuarterUnavailable: (v: boolean) => void;
}

/**
 * 분기 스냅샷을 조회해 결과를 컨텍스트로 반영한다. 훅 밖의 모듈 함수라 setter를 클로저로
 * 잡지 않고, 호출부에서 의존 계약이 보인다.
 *
 * 실패는 두 모양이며 둘 다 연간으로 되돌리고 `setQuarterUnavailable(true)`를 부른다.
 * - **reject**: 액션 Promise가 reject된다.
 * - **전부 빈 resolve**: 공급자가 FMP 예외를 삼키고 빈 스냅샷으로 resolve한다(캐시하지 않는다).
 * 어느 경우든 `setIsLoading(false)`는 `finally`로 보장된다.
 */
export async function fetchAndApplyQuarterSnapshot(
    symbol: string,
    ctx: FetchQuarterContext
): Promise<void> {
    try {
        const data = await getFinancialsQuarterAction(symbol);
        if (isEmptySnapshot(data)) {
            ctx.setPeriodState('annual');
            ctx.setQuarterUnavailable(true);
            return;
        }
        ctx.setQuarterSnapshot(data);
    } catch (error) {
        console.warn(
            '[fetchAndApplyQuarterSnapshot] quarter fetch failed, falling back to annual:',
            error
        );
        ctx.setPeriodState('annual');
        ctx.setQuarterUnavailable(true);
    } finally {
        ctx.setIsLoading(false);
    }
}
