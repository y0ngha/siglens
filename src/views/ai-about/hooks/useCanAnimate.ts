'use client';

import { useSyncExternalStore } from 'react';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function subscribeMotion(onChange: () => void) {
    const query = window.matchMedia(REDUCED_MOTION);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
}

/** Playback runs only on the client and only without a reduced-motion preference. */
export function useCanAnimate(): boolean {
    return useSyncExternalStore(
        subscribeMotion,
        () => !window.matchMedia(REDUCED_MOTION).matches,
        () => false
    );
}
