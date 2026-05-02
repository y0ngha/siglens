'use client';

import { useEffect } from 'react';

export function useEscapeKey(onEscape: () => void): void {
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onEscape();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onEscape]);
}
