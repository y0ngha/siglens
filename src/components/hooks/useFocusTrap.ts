'use client';

import { RefObject, useEffect, useEffectEvent } from 'react';

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'textarea:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Modal focus trap.
 *
 * Responsibilities while `active`:
 * 1. Move focus into the dialog on mount (first focusable child, or the
 *    container itself if it has `tabindex` and no focusable child).
 * 2. Wrap Tab / Shift+Tab so focus cannot leave the dialog.
 * 3. Restore focus to the element that was focused before the trap
 *    armed when the trap deactivates.
 *
 * Combined here (rather than split into a separate `useInitialFocus` /
 * `useRestoreFocus`) because all three behaviors share one lifecycle
 * — they arm and disarm together, and splitting them would duplicate
 * the `active` guard at every call site.
 */
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

        // Capture the trigger BEFORE we move focus into the dialog so
        // we can restore it when the trap deactivates.
        const previouslyFocused =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;

        const container = ref.current;
        if (container) {
            const firstFocusable =
                container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
            if (firstFocusable) {
                firstFocusable.focus();
            } else if (container.hasAttribute('tabindex')) {
                container.focus();
            }
        }

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            // Restore focus to the trigger that armed the trap — but
            // only if it is still in the DOM. If the user clicked
            // somewhere outside in the meantime, the dialog is being
            // closed in response to that click and we should not
            // steal focus back.
            if (
                previouslyFocused &&
                document.contains(previouslyFocused) &&
                document.activeElement !== previouslyFocused
            ) {
                previouslyFocused.focus();
            }
        };
    }, [active, ref]);
}
