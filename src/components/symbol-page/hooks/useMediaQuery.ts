'use client';

import { useCallback, useRef, useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
    const mqlRef = useRef<MediaQueryList | null>(null);

    const getMql = useCallback((): MediaQueryList => {
        if (mqlRef.current?.media !== query) {
            mqlRef.current = window.matchMedia(query);
        }
        return mqlRef.current;
    }, [query]);

    const subscribe = useCallback(
        (cb: () => void): (() => void) => {
            const mq = getMql();
            mq.addEventListener('change', cb);
            return () => mq.removeEventListener('change', cb);
        },
        [getMql]
    );

    return useSyncExternalStore(
        subscribe,
        () => getMql().matches,
        () => false
    );
}
