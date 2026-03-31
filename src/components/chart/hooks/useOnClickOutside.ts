'use client';

import { useEffect, useEffectEvent, type RefObject } from 'react';

type ClickOutsideEvent = MouseEvent | TouchEvent;

export function useOnClickOutside<T extends HTMLElement = HTMLElement>(
    ref: RefObject<T | null>,
    handler: (event: ClickOutsideEvent) => void
): void {
    const onEvent = useEffectEvent((event: ClickOutsideEvent) =>
        handler(event)
    );

    useEffect(() => {
        const listener = (event: ClickOutsideEvent) => {
            const el = ref.current;
            if (!el || el.contains(event.target as Node)) {
                return;
            }
            onEvent(event);
        };

        document.addEventListener('mousedown', listener);
        document.addEventListener('touchstart', listener);

        return () => {
            document.removeEventListener('mousedown', listener);
            document.removeEventListener('touchstart', listener);
        };
    }, [ref]);
}
