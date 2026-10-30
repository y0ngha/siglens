/**
 * @file 브라우저 설치 프롬프트(`beforeinstallprompt`)를 받아 두고 띄우는 모듈 함수.
 *
 * 훅(`useDeferredInstallPrompt`)은 받아 둔 이벤트만 쥐고, 리스너 배선과 프롬프트의
 * 오류 처리는 여기서 한다.
 */

type PromptOutcome = 'accepted' | 'dismissed';

/**
 * Chromium의 `beforeinstallprompt` 이벤트. TS 표준 DOM 타입에 없어 필요한 멤버만 적는다.
 * `prompt()`는 이벤트 하나당 한 번만 부를 수 있다.
 */
export interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    readonly userChoice: Promise<{ outcome: PromptOutcome }>;
}

/**
 * `window`의 `beforeinstallprompt`를 받아 `onPrompt`에 넘기고, 떼는 함수를 돌려준다.
 *
 * `preventDefault()`로 브라우저 기본 미니 인포바를 막는다 — 설치 권유는 배너 하나로만 한다.
 */
export function subscribeBeforeInstallPrompt(
    onPrompt: (event: BeforeInstallPromptEvent) => void
): () => void {
    const handlePrompt = (event: Event): void => {
        event.preventDefault();
        // 이 이벤트 이름으로 오는 것은 항상 BeforeInstallPromptEvent다.
        onPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handlePrompt);
    return () =>
        window.removeEventListener('beforeinstallprompt', handlePrompt);
}

/**
 * 받아 둔 설치 프롬프트를 띄우고 사용자가 설치를 수락했는지 돌려준다.
 *
 * 프롬프트 실패(이미 쓴 이벤트, 브라우저 거부)는 경고만 남기고 "수락 안 함"으로 본다 —
 * 배너가 그대로 남을 뿐 사용자에게 보일 오류가 없다.
 */
export async function runInstallPrompt(
    event: BeforeInstallPromptEvent
): Promise<boolean> {
    try {
        await event.prompt();
        const { outcome } = await event.userChoice;
        return outcome === 'accepted';
    } catch (err) {
        console.warn('[PWA] prompt 실패', err);
        return false;
    }
}
