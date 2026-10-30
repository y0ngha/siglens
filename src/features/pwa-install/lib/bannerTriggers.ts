/**
 * @file 설치 배너를 띄우는 **첫 사용자 입력** 방아쇠 — 이벤트 집합, `pointerup` 지연, 리스너 배선.
 *
 * 훅(`useFirstInputReveal`)은 상태만 갖고, `window` 리스너를 붙이고 떼는 일은 여기 모듈
 * 함수가 맡는다. 같은 집합을 하이드레이션 전 프로브(`firstInputProbe`)도 듣는다.
 */

/**
 * 곧바로 배너를 띄우는 첫 입력 이벤트.
 *
 * 첫 입력까지 기다리는 이유: **첫 화면을 배너가 가리지 않는다** — 검색 유입의 첫인상과
 * 구글 모바일 인터스티셜 판정(진입 직후 본문을 가리는 오버레이) 양쪽에 낫다.
 * `scroll`은 입력 이벤트가 아니라 넣지 않는다.
 *
 * 포인터 방아쇠는 `pointerdown`이 아니라 **탭이 끝난 뒤**다. `pointerdown`에서 띄우면 손가락이
 * 아직 닿아 있는 동안 배너가 커밋돼, 그 자리에 배너가 뜨는 경우(하단 입력창·상단 크롬 아래
 * 첫 카드) `pointerup`·`click`이 배너로 떨어져 사용자가 누르려던 것이 눌리지 않는다.
 * `click`은 `window`에 닿을 때 대상 요소의 처리가 이미 끝났다. `click` 없이 끝나는 탭은
 * `pointerup` + [[POINTERUP_REVEAL_DELAY_MS]]가 맡는다.
 *
 * 분석 완료 같은 앱 이벤트는 방아쇠가 아니다 — 회원은 마운트 시 분석이 자동으로 돌아
 * 입력 없이 배너가 뜨게 된다.
 */
export const BANNER_TRIGGER_EVENTS = ['click', 'keydown'] as const;

/**
 * `click` 없이 `pointerup`만 온 탭에서 배너를 띄우기까지의 여유(ms).
 *
 * iOS Safari는 글자·빈 곳처럼 클릭할 수 없는 요소를 탭하면 `click`을 `window`까지 보내지
 * 않는다 — `click`만 기다리면 컨트롤을 누르지 않는 iPhone 사용자에게 배너가 영영 뜨지
 * 않는다. 지연은 그 탭의 (늦게 올 수도 있는) `click`이 먼저 끝나게 하는 여유다.
 * 스크롤 제스처는 브라우저가 `pointercancel`로 끝내 `pointerup`·`click`이 없으므로 배너는
 * 첫 실제 탭까지 기다린다.
 */
export const POINTERUP_REVEAL_DELAY_MS = 500;

/** [[subscribeBannerTriggers]]가 부르는 콜백 — 어느 쪽이 먼저 오든 훅이 한 번만 반영한다. */
export interface BannerTriggerHandlers {
    /** [[BANNER_TRIGGER_EVENTS]] 중 하나가 왔다 — 곧바로 띄운다. */
    readonly onTrigger: () => void;
    /** `pointerup`이 왔다 — [[POINTERUP_REVEAL_DELAY_MS]] 뒤에 띄울 차례다. */
    readonly onPointerUp: () => void;
}

/**
 * 캡처 단계로 듣는다 — 버블 단계면 `stopPropagation()`하는 컨트롤(팝오버 트리거·메뉴
 * 항목)을 누른 탭이 `window`까지 오지 않아 방아쇠를 놓친다. 캡처 단계에서 상태를 바꿔도
 * 그 탭의 `click`은 이미 정해진 대상에 그대로 전달된다(대상은 디스패치 시작 때 고정).
 */
const LISTENER_OPTIONS = { passive: true, capture: true } as const;

/**
 * `window`에 첫 입력 방아쇠 리스너를 붙이고, 모두 떼는 함수를 돌려준다.
 *
 * 이벤트별 `once`를 쓰지 않는다 — 한쪽이 배너를 띄우고 사용자가 닫은 뒤 남아 있던 다른
 * 쪽이 배너를 다시 띄운다. 호출부가 첫 발화 뒤 반환 함수로 전부 걷는다.
 */
export function subscribeBannerTriggers(
    handlers: BannerTriggerHandlers
): () => void {
    BANNER_TRIGGER_EVENTS.forEach(type =>
        window.addEventListener(type, handlers.onTrigger, LISTENER_OPTIONS)
    );
    window.addEventListener(
        'pointerup',
        handlers.onPointerUp,
        LISTENER_OPTIONS
    );
    return () => {
        BANNER_TRIGGER_EVENTS.forEach(type =>
            window.removeEventListener(
                type,
                handlers.onTrigger,
                LISTENER_OPTIONS
            )
        );
        window.removeEventListener(
            'pointerup',
            handlers.onPointerUp,
            LISTENER_OPTIONS
        );
    };
}
