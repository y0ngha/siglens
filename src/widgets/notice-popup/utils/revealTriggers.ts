/**
 * 공지 팝업의 지연 노출(`useDeferredReveal`)을 일으키는 두 신호 — 첫 상호작용과 유휴
 * 폴백 — 를 브라우저에 붙이고 떼는 모듈 함수들. 훅 본문에 리스너·타이머 배선을 두지 않고
 * 각 함수가 정리 함수를 돌려준다.
 */

/** 아무것도 하지 않는 정리 함수 — 예약할 것이 없을 때 돌려준다. */
const NOOP = (): void => {};

/**
 * 첫 상호작용을 뜻하는 이벤트들. 스크롤·포인터·키보드·터치·휠 중 무엇이든 "읽기
 * 시작했다"는 신호로 충분하다. `pointermove`·`wheel`·`touchstart`는 데스크톱에서
 * 마우스를 움직이기만 한 사람, 트랙패드로 스크롤을 시작한 사람(`scroll`보다 먼저 온다)
 * 까지 잡는다.
 */
export const INTERACTION_EVENTS = [
    'pointerdown',
    'keydown',
    'scroll',
    'pointermove',
    'touchstart',
    'wheel',
] as const;

/**
 * `window`에 첫 상호작용 리스너를 붙이고 떼는 함수를 돌려준다. 각 이벤트는 `once`라
 * 처음 한 번만 반응하고, `passive`라 스크롤을 막지 않는다.
 */
export function listenForFirstInteraction(onInteract: () => void): () => void {
    INTERACTION_EVENTS.forEach(event =>
        window.addEventListener(event, onInteract, {
            once: true,
            passive: true,
        })
    );
    return () =>
        INTERACTION_EVENTS.forEach(event =>
            window.removeEventListener(event, onInteract)
        );
}

/**
 * 브라우저가 한가할 때 `callback`을 부르고 취소 함수를 돌려준다. `requestIdleCallback`이
 * 없는 브라우저(Safari)는 즉시 부른다 — 호출부가 이미 폴백 시간을 기다린 뒤라 더 미룰
 * 이유가 없다.
 */
export function scheduleIdle(callback: () => void): () => void {
    if (
        typeof window.requestIdleCallback === 'function' &&
        typeof window.cancelIdleCallback === 'function'
    ) {
        // 예약 시점의 취소 함수를 잡아 둔다 — 정리는 언마운트 때 돌아 그 사이 전역이
        // 바뀌어도(테스트 스텁 복원 등) 짝이 맞는 취소를 부른다.
        const cancel = window.cancelIdleCallback.bind(window);
        const id = window.requestIdleCallback(callback);
        return () => cancel(id);
    }
    callback();
    return NOOP;
}

/**
 * `delayMs`가 지난 뒤의 유휴 시점에 `callback`을 부른다. 돌려준 함수는 타이머와 — 이미
 * 타이머가 끝났다면 — 그 뒤에 예약된 유휴 콜백까지 함께 취소한다.
 */
export function scheduleIdleAfter(
    delayMs: number,
    callback: () => void
): () => void {
    let cancelIdle = NOOP;
    const timer = setTimeout(() => {
        cancelIdle = scheduleIdle(callback);
    }, delayMs);
    return () => {
        clearTimeout(timer);
        cancelIdle();
    };
}
