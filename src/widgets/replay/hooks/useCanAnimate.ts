'use client';

import { useSyncExternalStore } from 'react';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function subscribeMotion(onChange: () => void): () => void {
    const query = window.matchMedia(REDUCED_MOTION);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
}

/**
 * 재생 애니메이션을 돌려도 되는지. 서버·하이드레이션 첫 렌더는 항상 `false`(완성된 정적
 * 프레임)이고, 클라이언트에서 `prefers-reduced-motion: reduce`가 아닐 때만 `true`다.
 * `useReplayPlayback`이 소비한다.
 */
export function useCanAnimate(): boolean {
    return useSyncExternalStore(
        subscribeMotion,
        () => !window.matchMedia(REDUCED_MOTION).matches,
        () => false
    );
}
