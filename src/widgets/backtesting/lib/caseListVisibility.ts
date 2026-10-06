/**
 * 백테스트 케이스 목록의 "어느 탭에서 보이는가" 표기.
 *
 * 목록(`BacktestCaseList`)은 서버 컴포넌트로 한 번만 렌더된다. 종목 탭을 바꿀 때 목록을
 * 클라이언트에서 다시 그리지 않고, 각 요소에 붙은 토큰으로 보이는 범위만 고른다
 * (`useCaseListVisibility`). 그래서 100건짜리 케이스 데이터가 RSC 페이로드로 클라이언트에
 * 넘어가 카드 트리 전체를 하이드레이션하던 비용이 없다.
 *
 * 토큰은 공백으로 구분한 목록이다(`[attr~=token]`과 같은 규칙):
 * - 티커(`AAPL`): 그 종목 탭에서 보인다.
 * - {@link UNFILTERED_TOKEN}: "전체" 탭에서 보인다.
 */
export const VISIBILITY_ATTR = 'data-backtest-show';

/** "전체" 탭 토큰. 티커는 영숫자 대문자라 겹치지 않는다. */
export const UNFILTERED_TOKEN = '*';

/** JSX에 펼쳐 넣을 표기 속성. */
export function visibilityAttrs(
    tokens: readonly string[]
): Record<typeof VISIBILITY_ATTR, string> {
    return { [VISIBILITY_ATTR]: tokens.join(' ') };
}

/** 표기 속성 값이 지금 탭 토큰에서 보이는지. */
export function isVisibleFor(attrValue: string, token: string): boolean {
    return attrValue.split(' ').includes(token);
}
