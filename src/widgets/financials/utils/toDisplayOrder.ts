/**
 * 공급자 행(최신→과거)을 표시 순서(과거→최신)로 돌리는 헬퍼.
 */

/**
 * 행을 과거→최신(좌→우) 표시 순서의 새 배열로 돌려준다.
 *
 * 재무제표 행은 공급자에서 최신→과거(index 0 = 최신)로 오지만 표와 추세 차트는
 * 과거→최신으로 그린다. 비파괴 `toReversed()`를 써 prop을 바꾸지 않으며, 네 섹션이
 * 이 한 곳을 공유해 "표시용 뒤집기"의 의도가 흩어지지 않는다.
 */
export function toDisplayOrder<T>(rows: readonly T[]): T[] {
    return rows.toReversed();
}
