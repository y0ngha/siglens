'use client';

import { useEffect, useEffectEvent, RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'textarea:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function useFocusTrap(
    ref: RefObject<HTMLElement | null>,
    active: boolean
): void {
    const handleKeyDown = useEffectEvent((e: KeyboardEvent) => {
        if (e.key !== 'Tab' || !ref.current) return;

        const focusable =
            ref.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (focusable.length === 0) return;

        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;

        if (e.shiftKey) {
            if (
                document.activeElement === first ||
                document.activeElement === ref.current
            ) {
                e.preventDefault();
                last.focus();
            }
        } else {
            if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    });

    useEffect(() => {
        if (!active) return;
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [active]);
}
