import type { FinancialsSnapshot } from '@y0ngha/siglens-core';

/** annual 조회 기본 limit(5년). 연간 SSR 경로와 `getFinancialsSnapshot` 기본값이 공유한다. */
export const ANNUAL_LIMIT = 5;

/** quarter 조회 limit(8분기 ≈ 2년). quarter Server Action이 사용한다. */
export const QUARTER_LIMIT = 8;

/**
 * statement 3섹션(income/balance/cashFlow)이 모두 비어 있으면 true.
 *
 * `CachedFinancialStatementsProvider`가 FMP 장애를 swallow해 `[]`를 반환하면 정규화
 * 결과도 all-empty가 된다. 호출 측(page RSC / quarter 토글)은 이 값으로 "데이터 없음/
 * 일시 실패"를 판정해 degrade UI로 전환하고 색인을 막는다(scorecard가 전 축 F로
 * 오인 렌더되어 색인되는 것을 방지).
 */
export function isEmptyFinancialsSnapshot(
    snapshot: FinancialsSnapshot
): boolean {
    return (
        snapshot.income.length === 0 &&
        snapshot.balance.length === 0 &&
        snapshot.cashFlow.length === 0
    );
}
