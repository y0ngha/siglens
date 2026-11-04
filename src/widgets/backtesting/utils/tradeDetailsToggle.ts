/** 서버 행이 상세 자리에 남기는 속성. 값은 `tradeKey`. */
export const TRADE_DETAIL_ATTR = 'data-trade-detail';

/**
 * `root` 안의 매매 행(`<details>`)이 열릴 때 `onOpen(key, placeholder)`를 부른다. 구독하는 순간
 * 이미 열려 있는 행도 한 번씩 알린다 — 하이드레이션 전에 사용자가 연 행이나 뒤로 가기로 브라우저가
 * `open`을 되살린 행은 `toggle`이 이미 지나가 버려 본문이 비어 있게 된다.
 *
 * `toggle` 이벤트는 버블링하지 않아 캡처 단계에서 받는다. 월 섹션(`<details>`)도 같은 이벤트를
 * 내지만 바로 아래에 상세 자리가 없어 무시된다. 리스너 연결은 훅 밖에 둔다(REACT.md#EF-3).
 */
export function subscribeTradeDetailsOpen(
    root: HTMLElement,
    onOpen: (key: string, placeholder: HTMLElement) => void
): () => void {
    function handleToggle(event: Event): void {
        const target = event.target;
        if (!(target instanceof HTMLDetailsElement) || !target.open) return;
        const placeholder = target.querySelector<HTMLElement>(
            `:scope > [${TRADE_DETAIL_ATTR}]`
        );
        const key = placeholder?.getAttribute(TRADE_DETAIL_ATTR);
        if (placeholder && key) onOpen(key, placeholder);
    }
    root.addEventListener('toggle', handleToggle, true);
    for (const placeholder of root.querySelectorAll<HTMLElement>(
        `details[open] > [${TRADE_DETAIL_ATTR}]`
    )) {
        const key = placeholder.getAttribute(TRADE_DETAIL_ATTR);
        if (key) onOpen(key, placeholder);
    }
    return () => root.removeEventListener('toggle', handleToggle, true);
}
