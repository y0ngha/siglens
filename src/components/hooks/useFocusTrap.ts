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

// 모달용 포커스 트랩: 진입 시 포커스 이동 + Tab/Shift+Tab 순환 + 해제 시 트리거 복원.
// 세 동작이 같은 lifecycle을 공유하므로 단일 훅으로 결합 (분리 시 active 가드 중복 발생).
/** Modal focus trap (initial focus + Tab wrap + restore on deactivate). */
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
        // react-hooks/exhaustive-deps requires the ref param even though RefObject identity is stable.
    }, [active, ref]);
}
