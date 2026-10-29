'use client';

import { useCallback, useEffect, useRef } from 'react';
import {
    type BeforeInstallPromptEvent,
    runInstallPrompt,
    subscribeBeforeInstallPrompt,
} from '../lib/installPrompt';

/**
 * 브라우저 설치 프롬프트를 받아 두고, 설치 버튼이 부를 안정적인 `prompt` 함수를 돌려준다
 * (`usePwaInstall` 전용).
 *
 * 프롬프트는 배너 방아쇠와 무관하게 `enabled`인 동안 받아 둔다 — 첫 탭 뒤에 와도 설치
 * 버튼이 써야 한다. `prompt`는 받아 둔 이벤트를 **먼저 비우고** 띄운다: 이벤트는 한 번만
 * 쓸 수 있고, 연타한 두 번째 클릭이 같은 이벤트를 다시 부르지 않게 한다. 받아 둔 것이
 * 없으면 아무것도 띄우지 않고 false로 끝난다.
 */
export function useDeferredInstallPrompt(
    enabled: boolean
): () => Promise<boolean> {
    const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

    const prompt = useCallback(async (): Promise<boolean> => {
        const event = deferredPromptRef.current;
        if (!event) return false;
        deferredPromptRef.current = null;
        return runInstallPrompt(event);
    }, []);

    useEffect(() => {
        if (!enabled) return;
        return subscribeBeforeInstallPrompt(event => {
            deferredPromptRef.current = event;
        });
    }, [enabled]);

    return prompt;
}
