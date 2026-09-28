import type { KeyboardEvent } from 'react';

/**
 * IME 조합 중 발생한 keydown인지 판별한다.
 *
 * 한글 IME는 음절을 **확정**할 때도 Enter를 쓴다. 이걸 걸러내지 않으면 `삼성전`까지
 * 친 상태에서 확정 Enter가 선택/이동을 일으킨다. 표준 신호는 `isComposing`이지만
 * Safari는 조합을 끝내는 keydown을 `isComposing: false`로 보내고 대신
 * `keyCode === 229`(IME 처리 중)로 표시하므로 둘 다 본다.
 */
export function isImeComposing(e: KeyboardEvent<HTMLElement>): boolean {
    return e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229;
}
