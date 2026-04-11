'use client';

import { useEffect, RefObject } from 'react';

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
    useEffect(() => {
        if (!active) return;

        function handleKeyDown(e: KeyboardEvent) {
            if (e.key !== 'Tab' || !ref.current) return;

            const focusable = Array.from(
                ref.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
            );
            if (focusable.length === 0) return;

            const first = focusable[0]!;
            const last = focusable[focusable.length - 1]!;

            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        }

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [active, ref]);
}
