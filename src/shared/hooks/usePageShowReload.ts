'use client';

import { useEffect } from 'react';

/** Reloads the page when restored from bfcache (back/forward navigation). */
export function usePageShowReload(): void {
    useEffect(() => {
        const handler = (event: PageTransitionEvent): void => {
            if (event.persisted) {
                window.location.reload();
            }
        };
        window.addEventListener('pageshow', handler);
        return () => window.removeEventListener('pageshow', handler);
    }, []);
}
