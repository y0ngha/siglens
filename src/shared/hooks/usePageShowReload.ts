'use client';

import { useEffect } from 'react';
import { pageReload } from '@/shared/lib/pageReload';

/** Reloads the page when restored from bfcache (back/forward navigation). */
export function usePageShowReload(): void {
    useEffect(() => {
        const handler = (event: PageTransitionEvent): void => {
            if (event.persisted) {
                pageReload();
            }
        };
        window.addEventListener('pageshow', handler);
        return () => window.removeEventListener('pageshow', handler);
    }, []);
}
