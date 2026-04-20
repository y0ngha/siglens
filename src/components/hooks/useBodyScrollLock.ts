'use client';

import { useEffect } from 'react';

// !important — AdSense가 html/body overflow를 덮어쓰는 문제를 방지한다.
export function useBodyScrollLock(): void {
    useEffect(() => {
        const html = document.documentElement;
        const body = document.body;

        html.style.setProperty('height', '100%', 'important');
        html.style.setProperty('overflow', 'hidden', 'important');
        body.style.setProperty('height', '100%', 'important');
        body.style.setProperty('overflow', 'hidden', 'important');

        return () => {
            html.style.removeProperty('height');
            html.style.removeProperty('overflow');
            body.style.removeProperty('height');
            body.style.removeProperty('overflow');
        };
    }, []);
}
