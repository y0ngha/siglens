'use client';

import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

export function useOnClickOutside(
    ref: RefObject<HTMLElement | null>,
    handler: () => void
): void {
    const savedHandler = useRef(handler);

    useLayoutEffect(() => {
        savedHandler.current = handler;
    });

    useEffect(() => {
        function handlePointerDown(event: PointerEvent) {
            if (
                ref.current != null &&
                !ref.current.contains(event.target as Node)
            ) {
                savedHandler.current();
            }
        }
        document.addEventListener('pointerdown', handlePointerDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
        };
    }, [ref]);
}
