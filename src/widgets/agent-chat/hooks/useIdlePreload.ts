'use client';

/**
 * 조건이 참인 동안 브라우저가 한가할 때 청크를 미리 받아 두는 훅.
 */
import { useEffect } from 'react';

/** `requestIdleCallback`이 없는 브라우저(Safari)에서 첫 페인트 뒤로 미루는 지연. */
const PRELOAD_FALLBACK_MS = 2_000;

/** 유휴 시간(없으면 짧은 지연 뒤)에 `load`를 한 번 예약하고 취소 함수를 돌려준다. */
function scheduleWhenIdle(load: () => void): () => void {
    if (
        typeof window.requestIdleCallback === 'function' &&
        typeof window.cancelIdleCallback === 'function'
    ) {
        // 예약한 쪽의 취소 함수를 잡아 둔다 — 정리 시점에 전역이 바뀌어도 짝이 맞는다.
        const cancel = window.cancelIdleCallback.bind(window);
        const id = window.requestIdleCallback(load);
        return () => cancel(id);
    }
    const id = setTimeout(load, PRELOAD_FALLBACK_MS);
    return () => clearTimeout(id);
}

/** `enabled`인 동안 `load`를 유휴 시간에 미리 부른다 — 첫 로드 파싱·실행 경로에서는 빠진다. */
export function useIdlePreload(load: () => void, enabled: boolean): void {
    useEffect(() => {
        if (!enabled) return;
        return scheduleWhenIdle(load);
    }, [load, enabled]);
}
