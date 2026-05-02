'use client';

import { useEffect, useEffectEvent } from 'react';

export function useEscapeKey(onEscape: () => void): void {
    const stableOnEscape = useEffectEvent(onEscape);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') stableOnEscape();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);
}
