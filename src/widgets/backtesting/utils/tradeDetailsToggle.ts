import { MONTH_SECTION_ATTR } from './monthOpenState';

/** 서버 행이 상세 자리에 남기는 속성. 값은 `tradeKey`. */
export const TRADE_DETAIL_ATTR = 'data-trade-detail';

/** 나중에 그리는 월 섹션이 행 자리에 남기는 속성. 값은 월 키(`YYYY-MM`). */
export const LAZY_MONTH_ATTR = 'data-lazy-month';

/**
 * `root` 안에서 `<details>`가 열릴 때 `findSlot(그 details)`로 자리를 찾아 `onOpen(attr 값, 자리)`로
 * 알린다. 구독하는 순간 이미 열려 있는 것(`openSlotsSelector`)도 한 번씩 알린다 — 하이드레이션
 * 전에 사용자가 연 것이나 뒤로 가기로 브라우저가 `open`을 되살린 것은 `toggle`이 이미 지나가 버려
 * 본문이 비어 있게 된다.
 *
 * `toggle` 이벤트는 버블링하지 않아 캡처 단계에서 받는다. 리스너 연결은 훅 밖에 둔다(REACT.md#EF-3).
 */
function subscribeDetailsSlotOpen(
    root: HTMLElement,
    attr: string,
    findSlot: (details: HTMLDetailsElement) => HTMLElement | null,
    openSlotsSelector: string,
    onOpen: (value: string, slot: HTMLElement) => void
): () => void {
    function report(slot: HTMLElement | null): void {
        const value = slot?.getAttribute(attr);
        if (slot && value) onOpen(value, slot);
    }
    function handleToggle(event: Event): void {
        const target = event.target;
        if (!(target instanceof HTMLDetailsElement) || !target.open) return;
        report(findSlot(target));
    }
    root.addEventListener('toggle', handleToggle, true);
    for (const slot of root.querySelectorAll<HTMLElement>(openSlotsSelector)) {
        report(slot);
    }
    return () => root.removeEventListener('toggle', handleToggle, true);
}

/**
 * `root` 안의 매매 행(`<details>`)이 열릴 때 `onOpen(key, placeholder)`를 부른다. 월 섹션도 같은
 * 이벤트를 내지만 바로 아래에 상세 자리가 없어 무시된다.
 */
export function subscribeTradeDetailsOpen(
    root: HTMLElement,
    onOpen: (key: string, placeholder: HTMLElement) => void
): () => void {
    return subscribeDetailsSlotOpen(
        root,
        TRADE_DETAIL_ATTR,
        details =>
            details.querySelector<HTMLElement>(
                `:scope > [${TRADE_DETAIL_ATTR}]`
            ),
        `details[open] > [${TRADE_DETAIL_ATTR}]`,
        onOpen
    );
}

/**
 * `root` 안에서 행을 아직 그리지 않은 월 섹션이 열릴 때 `onOpen(monthKey, placeholder)`를 부른다.
 * 월 섹션은 표식(`MONTH_SECTION_ATTR`)으로 고르고 자리는 그 안에서 찾는다 — 월 본문의 마크업
 * 깊이에 기대지 않는다. 매매 행은 표식이 없어 무시된다.
 */
export function subscribeLazyMonthOpen(
    root: HTMLElement,
    onOpen: (monthKey: string, placeholder: HTMLElement) => void
): () => void {
    return subscribeDetailsSlotOpen(
        root,
        LAZY_MONTH_ATTR,
        details =>
            details.hasAttribute(MONTH_SECTION_ATTR)
                ? details.querySelector<HTMLElement>(`[${LAZY_MONTH_ATTR}]`)
                : null,
        `details[${MONTH_SECTION_ATTR}][open] [${LAZY_MONTH_ATTR}]`,
        onOpen
    );
}
