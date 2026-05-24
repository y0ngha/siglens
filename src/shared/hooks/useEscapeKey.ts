'use client';

import { useEffect, useEffectEvent } from 'react';

export function useEscapeKey(onEscape: () => void, enabled: boolean): void {
    const handleKeyDown = useEffectEvent((e: KeyboardEvent) => {
        if (e.key === 'Escape') onEscape();
    });

    useEffect(() => {
        if (!enabled) return;
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [enabled]);
}
