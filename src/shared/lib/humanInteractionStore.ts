/**
 * "이 탭에서 사람이 입력을 한 적이 있는가"를 담는 모듈 스토어.
 *
 * AI 분석 자동 실행 게이트(`useAiAutoRunAllowed`)가 쓴다. 큐레이션 밖(noindex) 종목은
 * 이 값이 참이 되기 전까지 캐시만 조회한다 — 렌더만 하고 떠나는 크롤러가 LLM 생성을
 * 일으키지 않게 하려는 것이다(spec `2026-10-04-longtail-ai-interaction-gate-design.md`).
 *
 * ## `onFirstInteraction`과 플래그를 공유하지 않는 이유
 *
 * 방문자 집계(`shared/lib/onFirstInteraction`)는 헤드리스 판별을 위해 `pointermove`를
 * 일부러 듣지 않는다. 여기서는 반대로 `pointermove`를 인정한다 — 데스크톱에서 마우스만
 * 움직이며 읽는 사람이 분석을 못 보는 일을 막는 쪽이 비용보다 중요하다. 플래그를
 * 공유하면 마우스만 움직인 방문이 DAU로 잡혀 집계 정의가 조용히 바뀐다.
 *
 * ## 탭 세션 동안 유지
 *
 * 인정되면 `sessionStorage`에 남긴다. 사이트 안 이동은 클라이언트 내비게이션이라 모듈
 * 플래그가 그대로지만, 새로고침·전체 로드에서도 같은 탭이면 다시 기다리지 않게 한다.
 * 저장소 접근이 막힌 환경(프라이빗 모드 등)에서는 메모리 플래그만 쓴다.
 *
 * 한계: CDP `Input.dispatch*`로 입력을 흉내 내는 봇은 통과한다(`isTrusted`가 참).
 */
const INTERACTION_EVENTS = [
    'pointerdown',
    'keydown',
    'wheel',
    'pointermove',
] as const;
const LISTENER_OPTIONS = { capture: true, passive: true } as const;
export const HUMAN_INTERACTION_STORAGE_KEY = 'siglens:ai-interacted';

let interacted = false;
let storageChecked = false;
let listening = false;
const subscribers = new Set<() => void>();

function readStorage(): boolean {
    try {
        return (
            window.sessionStorage.getItem(HUMAN_INTERACTION_STORAGE_KEY) === '1'
        );
    } catch {
        return false;
    }
}

function writeStorage(): void {
    try {
        window.sessionStorage.setItem(HUMAN_INTERACTION_STORAGE_KEY, '1');
    } catch {
        // 저장소가 막혀 있으면 메모리 플래그만 남는다 — 다음 전체 로드에서 다시 기다린다.
    }
}

function detachListeners(): void {
    if (!listening) return;
    listening = false;
    for (const type of INTERACTION_EVENTS) {
        window.removeEventListener(type, handleEvent, LISTENER_OPTIONS);
    }
}

function handleEvent(event: Event): void {
    if (!event.isTrusted) return;
    markHumanInteracted();
}

/** 지금까지 신뢰 입력이 있었는지. 첫 호출 때 `sessionStorage`를 한 번 읽는다. */
export function hasHumanInteracted(): boolean {
    if (!interacted && !storageChecked && typeof window !== 'undefined') {
        storageChecked = true;
        interacted = readStorage();
    }
    return interacted;
}

/**
 * 입력을 인정한다. 리스너가 받은 신뢰 입력, 또는 "AI 분석 보기" 버튼처럼 명시적인
 * 사용자 조작에서 부른다(키보드·보조기기로 버튼을 눌러도 확실히 인정되도록).
 */
export function markHumanInteracted(): void {
    if (interacted) return;
    interacted = true;
    storageChecked = true;
    writeStorage();
    detachListeners();
    for (const notify of subscribers) notify();
}

/**
 * 변화를 구독한다(`useSyncExternalStore`용). 첫 구독 때 전역 리스너를 한 번만 단다 —
 * 위젯 여러 개가 구독해도 리스너는 한 벌이다.
 */
export function subscribeHumanInteraction(onChange: () => void): () => void {
    subscribers.add(onChange);
    if (!hasHumanInteracted() && !listening) {
        listening = true;
        for (const type of INTERACTION_EVENTS) {
            window.addEventListener(type, handleEvent, LISTENER_OPTIONS);
        }
    }
    return () => {
        subscribers.delete(onChange);
        if (subscribers.size === 0) detachListeners();
    };
}

/** 테스트 전용 — 모듈 상태를 초기화한다. */
export function __resetHumanInteractionForTests(): void {
    detachListeners();
    interacted = false;
    storageChecked = false;
    subscribers.clear();
}
