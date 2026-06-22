/**
 * 요소가 (line-clamp 등으로) 잘려 내용이 넘치는지 판정하는 순수 함수.
 * `scrollHeight`(전체 콘텐츠 높이) > `clientHeight`(보이는 높이)이면 클램프된 것.
 * 서브픽셀 반올림으로 1px 정도 차이가 날 수 있어 여유분 1px을 둔다.
 */
export function isElementClamped(el: HTMLElement | null): boolean {
    if (el == null) return false;
    return el.scrollHeight > el.clientHeight + 1;
}
