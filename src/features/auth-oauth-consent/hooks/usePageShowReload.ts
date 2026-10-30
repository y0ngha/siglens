'use client';

import { useEffect } from 'react';
import { pageReload } from '@/shared/lib/pageReload';

/**
 * 뒤로/앞으로 가기로 bfcache에서 복원된 페이지(`pageshow`의 `persisted`)를 새로 고친다.
 * bfcache 복원은 JS 상태를 그대로 되살리므로, 새로 받아 폼 상태를 초기화한다.
 */
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
