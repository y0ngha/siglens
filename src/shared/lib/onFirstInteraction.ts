/**
 * 첫 **신뢰 입력** 뒤에 콜백을 한 번 실행한다. 반환값은 대기 중 리스너 해제 함수.
 *
 * 방문 비콘을 이 뒤에 두는 이유: 2026-09 `visitor_days` 실측에서 KR 외 행의 대부분이
 * `navigator.webdriver`를 숨긴 헤드리스였다 — JS를 실행하고 정상 UA를 달아 기존 필터를
 * 전부 통과했지만, 페이지를 렌더만 하고 떠나 입력 이벤트를 만들지 않는다.
 *
 * - `scroll`은 듣지 않는다. 크롤러의 `window.scrollTo`로도 발생한다. `wheel`은 실제
 *   입력에서만 난다. 터치는 `pointerdown`이 덮는다.
 * - `isTrusted === false`(스크립트 `dispatchEvent`)는 무시한다.
 * - 한 번 입력이 인정되면 모듈 플래그가 남아 이후 호출은 즉시 실행된다 — SPA 내부 이동은
 *   그 자체가 클릭이므로 새 페이지에서 다시 기다릴 이유가 없다.
 *
 * 한계: CDP `Input.dispatch*`로 입력을 흉내 내는 봇은 통과한다.
 */
const INTERACTION_EVENTS = ['pointerdown', 'keydown', 'wheel'] as const;
const LISTENER_OPTIONS = { capture: true, passive: true } as const;

let interacted = false;

export function onFirstInteraction(callback: () => void): () => void {
    if (interacted) {
        callback();
        return () => {};
    }

    let detached = false;
    const detach = (): void => {
        detached = true;
        for (const type of INTERACTION_EVENTS) {
            window.removeEventListener(type, handle, LISTENER_OPTIONS);
        }
    };
    function handle(event: Event): void {
        if (detached || !event.isTrusted) return;
        interacted = true;
        detach();
        callback();
    }

    for (const type of INTERACTION_EVENTS) {
        window.addEventListener(type, handle, LISTENER_OPTIONS);
    }
    return detach;
}
