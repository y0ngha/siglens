/** 목록 영역이 그릴 상태. 로딩·조회 실패·빈 목록·목록은 동시에 그려지지 않는다. */
export type HoldingsListView = 'loading' | 'error' | 'empty' | 'list';

/**
 * `PortfolioSection`의 목록 영역 상태를 하나로 고른다. 조회 실패를 빈 목록보다 먼저 봐서
 * "불러오지 못함"이 "보유 없음"으로 보이지 않게 한다.
 */
export function resolveHoldingsListView(
    isLoading: boolean,
    isError: boolean,
    count: number
): HoldingsListView {
    if (isLoading) return 'loading';
    if (isError) return 'error';
    return count === 0 ? 'empty' : 'list';
}

/**
 * 지금 열린 행이 `symbol`일 때만 닫는 `setState` 갱신 함수를 만든다. 저장·삭제 응답이 늦게
 * 도착해도 그사이 사용자가 연 다른 행의 편집·삭제 확인을 닫지 않게 한다.
 */
export function closeIfCurrent(
    symbol: string
): (current: string | null) => string | null {
    return current => (current === symbol ? null : current);
}
