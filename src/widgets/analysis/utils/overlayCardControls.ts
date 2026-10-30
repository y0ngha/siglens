/**
 * 패턴·전략 카드의 차트 작도 제어 — 콜백 묶음 조립과 카드 hover 강조 핸들러.
 */
import type { PointerEvent } from 'react';
import type { OverlayCardControls } from '../model/types';

/** 카드 루트에 펼쳐 붙이는 hover 핸들러. */
export interface OverlayHoverHandlers {
    onPointerEnter?: (e: PointerEvent) => void;
    onPointerLeave?: (e: PointerEvent) => void;
}

/**
 * 카드 버튼이 쓸 작도 제어를 조립한다 — 콜백이 하나라도 없으면(테스트·공유 뷰 등)
 * `undefined`를 돌려 버튼을 띄우지 않는다.
 */
export function toOverlayCardControls(
    hiddenKeys: ReadonlySet<string>,
    onToggle: ((key: string) => void) | undefined,
    onHighlight: ((key: string | null) => void) | undefined,
    onClearHighlight: ((key: string) => void) | undefined
): OverlayCardControls | undefined {
    if (
        onToggle === undefined ||
        onHighlight === undefined ||
        onClearHighlight === undefined
    )
        return undefined;
    return { hiddenKeys, onToggle, onHighlight, onClearHighlight };
}

/**
 * 카드 루트에 붙이는 hover 강조 핸들러. 작도가 없는 카드는 빈 객체.
 *
 * `mouseenter`가 아니라 `pointerType === 'mouse'`인 포인터 이벤트만 본다 — 터치
 * 기기는 탭할 때 호환 `mouseenter`를 쏘고 `mouseleave`는 다른 곳을 탭할 때까지
 * 보내지 않아, 모바일에서 버튼을 한 번 누르면 강조가 걸린 채 남는다(설계: 모바일은
 * 강조 없음).
 *
 * 떠날 때는 멱등 해제(`onClearHighlight(key)`)를 쓴다 — 무조건 `null`로 지우면
 * 키보드 포커스로 다른 카드가 잡고 있던 강조까지 함께 사라진다.
 */
export function overlayHoverHandlers(
    overlay: OverlayCardControls | undefined,
    key: string
): OverlayHoverHandlers {
    if (overlay === undefined) return {};
    return {
        onPointerEnter: e => {
            if (e.pointerType === 'mouse') overlay.onHighlight(key);
        },
        onPointerLeave: e => {
            if (e.pointerType === 'mouse') overlay.onClearHighlight(key);
        },
    };
}
