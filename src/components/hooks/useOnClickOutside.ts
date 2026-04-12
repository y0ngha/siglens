'use client';

import { useEffect, useEffectEvent, type RefObject } from 'react';

export function useOnClickOutside(
    refs: RefObject<HTMLElement | null> | RefObject<HTMLElement | null>[],
    handler: (event: PointerEvent) => void,
    { enabled = true }: { enabled?: boolean } = {}
): void {
    const handlePointerDown = useEffectEvent((event: PointerEvent) => {
        const refsArray = Array.isArray(refs) ? refs : [refs];
        // EventTarget → Node: .contains() requires Node; DOM element cast is safe here
        const target = event.target as Node;
        const isOutside = refsArray.every(
            ref => !ref.current?.contains(target)
        );
        if (isOutside) handler(event);
    });

    useEffect(() => {
        if (!enabled) return;
        document.addEventListener('pointerdown', handlePointerDown);
        return () =>
            document.removeEventListener('pointerdown', handlePointerDown);
    }, [enabled]);
}
