'use client';

import { useEffect, useLayoutEffect, useRef, RefObject } from 'react';

export function useOnClickOutside(
    refs: RefObject<HTMLElement | null>[],
    handler: () => void
): void {
    const savedHandler = useRef(handler);
    const savedRefs = useRef(refs);

    useLayoutEffect(() => {
        savedHandler.current = handler;
        savedRefs.current = refs;
    });

    useEffect(() => {
        function handleMouseDown(e: MouseEvent) {
            // EventTarget → Node: .contains() requires Node; DOM element cast is safe here
            const target = e.target as Node;
            const isOutside = savedRefs.current.every(
                ref => !ref.current?.contains(target)
            );
            if (isOutside) savedHandler.current();
        }
        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, []);
}
