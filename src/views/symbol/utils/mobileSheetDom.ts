/**
 * vaul이 현재 적용한 translateY 값(px)을 computed style에서 읽는다. `useMobileSheetDrag`가 터치
 * 시작 시 진행 중인 스냅 애니메이션 위치를 잡아 그 자리에서 드래그를 잇는 데 쓴다.
 */
export function captureTransformY(el: HTMLDivElement): number {
    return new DOMMatrix(window.getComputedStyle(el).transform).m42;
}
