/** 요약 카드 그리드의 넓은 화면 열 수. */

/** 한 줄에 펼치는 최대 카드 수. 이보다 많으면 카드가 좁아지지 않게 세 열로 접는다. */
export const SUMMARY_SINGLE_ROW_MAX_CARDS = 4;

/** 카드 수에 맞는 `lg:` 열 클래스. */
export function summaryGridColumnsClass(cardCount: number): string {
    if (cardCount <= SUMMARY_SINGLE_ROW_MAX_CARDS) return 'lg:grid-cols-4';
    return 'lg:grid-cols-3';
}
