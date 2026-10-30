/** 관심 탭 목록이 "아직 모름"인지 판정하는 데 필요한 `useWatchlist` 상태. */
export interface WatchlistListStateInput {
    isHydrated: boolean;
    isIdentityPending: boolean;
    itemCount: number;
}

/**
 * 관심 탭 목록이 아직 확정되지 않았는가. 하이드레이션 전이거나, 회원 여부를 모르는 동안의
 * 빈 목록이면 true — 그 빈 목록은 "계정에 없음"이 아니라 로컬 목록일 뿐이다. 목록(로딩 상태)과
 * 탭의 개수 표시가 같은 판정을 써야 "관심 0" 옆에 로딩이 함께 뜨지 않는다.
 */
export function isWatchlistListPending({
    isHydrated,
    isIdentityPending,
    itemCount,
}: WatchlistListStateInput): boolean {
    if (!isHydrated) return true;
    return itemCount === 0 && isIdentityPending;
}
