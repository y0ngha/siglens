/**
 * 백테스트 케이스 목록의 "어느 탭에서 보이는가" 표기와 그 적용.
 *
 * 목록(`BacktestCaseList`)은 서버 컴포넌트로 한 번만 렌더된다. 종목 탭을 바꿀 때 목록을
 * 클라이언트에서 다시 그리지 않고, 각 요소에 붙은 토큰으로 보이는 범위만 고른다
 * (`useCaseListVisibility`). 그래서 100건짜리 케이스 데이터가 RSC 페이로드로 클라이언트에
 * 넘어가 카드 트리 전체를 하이드레이션하는 비용이 없다.
 *
 * 토큰은 공백으로 구분한 목록이다(`[attr~=token]`과 같은 규칙):
 * - 티커(`AAPL`): 그 종목 탭에서 보인다.
 * - {@link UNFILTERED_TOKEN}: "전체" 탭에서 보인다.
 */
export const VISIBILITY_ATTR = 'data-backtest-show';

/** 케이스 카드 래퍼 표식. 보이는 카드가 하나도 없는지 셀 때 쓴다. */
export const CARD_ATTR = 'data-backtest-card';

/** "선택한 종목에 카드가 없음" 안내 요소 표식. 보이는 카드가 없을 때만 드러난다. */
export const EMPTY_ATTR = 'data-backtest-empty';

/** "전체" 탭 토큰. 티커는 영숫자 대문자라 겹치지 않는다. */
export const UNFILTERED_TOKEN = '*';

/** JSX에 펼쳐 넣을 표기 속성. */
export function visibilityAttrs(
    tokens: readonly string[]
): Record<typeof VISIBILITY_ATTR, string> {
    return { [VISIBILITY_ATTR]: tokens.join(' ') };
}

/** 케이스 카드 래퍼용 속성: 표기 속성 + 카드 표식. */
export function cardAttrs(
    tokens: readonly string[]
): Record<typeof VISIBILITY_ATTR | typeof CARD_ATTR, string> {
    return { ...visibilityAttrs(tokens), [CARD_ATTR]: '' };
}

/** 안내 요소용 속성: 숨김 상태로 시작하는 표식. */
export function emptyAttrs(): Record<typeof EMPTY_ATTR, string> {
    return { [EMPTY_ATTR]: '' };
}

/** 표기 속성 값이 지금 탭 토큰에서 보이는지. */
export function isVisibleFor(attrValue: string, token: string): boolean {
    return attrValue.split(' ').includes(token);
}

/**
 * `panel` 안의 표기 요소에 `hidden`을 적용하고, 보이는 카드가 하나도 없으면 안내
 * 요소({@link EMPTY_ATTR})를 드러낸다. 같은 토큰으로 여러 번 불러도 결과가 같다.
 */
export function applyCaseListVisibility(
    panel: ParentNode,
    token: string
): void {
    panel.querySelectorAll<HTMLElement>(`[${VISIBILITY_ATTR}]`).forEach(el => {
        el.hidden = !isVisibleFor(
            el.getAttribute(VISIBILITY_ATTR) ?? '',
            token
        );
    });
    const hasVisibleCard = Array.from(
        panel.querySelectorAll<HTMLElement>(`[${CARD_ATTR}]`)
    ).some(card => !card.hidden);
    panel.querySelectorAll<HTMLElement>(`[${EMPTY_ATTR}]`).forEach(el => {
        el.hidden = hasVisibleCard;
    });
}
