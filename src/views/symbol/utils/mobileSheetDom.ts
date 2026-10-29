/**
 * 모바일 시트 DOM에서 vaul이 적용한 transform을 읽는 헬퍼.
 */
/** vaul이 현재 적용한 translateY 값(px)을 computed style에서 읽는다. */
export function captureTransformY(el: HTMLDivElement): number {
    return new DOMMatrix(window.getComputedStyle(el).transform).m42;
}
