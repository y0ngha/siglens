'use client';

import { type RefObject, useEffect, useEffectEvent } from 'react';

/**
 * `refs` 중 어느 요소에도 속하지 않는 곳에서 `pointerdown`이 일어나면 `handler`를 부른다.
 * `enabled`가 `false`인 동안은 문서 리스너를 달지 않는다.
 */
export function useOnClickOutside(
    refs: RefObject<HTMLElement | null> | RefObject<HTMLElement | null>[],
    handler: (event: PointerEvent) => void,
    { enabled = true }: { enabled?: boolean } = {}
): void {
    const handlePointerDown = useEffectEvent((event: PointerEvent) => {
        const refsArray = Array.isArray(refs) ? refs : [refs];
        const target = event.target;
        // `contains()`는 Node만 받는다. Node가 아닌 타깃(window 등)은 어느 ref 안도 아니다.
        const isOutside = refsArray.every(
            ref => !(target instanceof Node && ref.current?.contains(target))
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
