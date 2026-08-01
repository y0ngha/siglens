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
    active: boolean,
    /**
     * 컨테이너 DOM 노드가 **교체**됐음을 알리는 값. 값이 바뀌면 트랩을 새 노드에
     * 다시 무장한다.
     *
     * 왜 필요한가: 아래 effect의 deps는 `[active, ref]`인데 둘 다 안정적이다.
     * `ref` 객체의 identity는 `.current`가 다른 노드를 가리키게 바뀌어도 그대로다.
     * 그래서 컨테이너를 렌더하는 자식이 서브트리를 remount하면(예: `PopoverSurface`가
     * 뷰포트 폭 변화로 인라인 렌더 ↔ `createPortal` 사이를 오갈 때 — Fragment와
     * Portal은 같은 위치의 서로 다른 fiber 타입이라 React가 unmount 후 remount한다)
     * effect가 재실행되지 않아 **트랩이 조용히 죽는다**: 포커스는 `body`로 떨어지고,
     * Tab이 다이얼로그 밖으로 새 나가며, 해제 시 트리거 복원도 일어나지 않는다.
     * 실제 시나리오는 기기 회전이다 — iPhone 14/15는 가로모드가 768px 이상이라
     * `(max-width: 767px)`가 true→false로 뒤집힌다.
     *
     * 컨테이너가 마운트 이후 교체될 수 있는 호출부만 넘기면 된다(예: `isMobile`).
     * 넘기지 않으면 종전과 동일하게 동작한다.
     */
    rearmKey?: unknown
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
        // rearmKey는 컨테이너 노드 교체를 감지하기 위한 것이다 — 위 JSDoc 참고.
    }, [active, ref, rearmKey]);
}
