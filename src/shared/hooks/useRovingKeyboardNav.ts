'use client';

import { type KeyboardEvent } from 'react';
import { getRovingNextIndex } from '@/shared/lib/rovingKeyboardNav';

interface UseRovingKeyboardNavOptions<T> {
    items: readonly T[];
    activeItem: T;
    onChange: (next: T) => void;
    focusItem: (next: T, e: KeyboardEvent<Element>) => void;
    withHomeEnd?: boolean;
}

/**
 * Arrow L/R + Home/End 기반 roving tabindex 내비게이션의 `onKeyDown` 핸들러를 만든다.
 * 활성 항목이 `items`에 없으면 아무것도 하지 않는다.
 */
export function useRovingKeyboardNav<T>({
    items,
    activeItem,
    onChange,
    focusItem,
    withHomeEnd = true,
}: UseRovingKeyboardNavOptions<T>): (e: KeyboardEvent<Element>) => void {
    return (e: KeyboardEvent<Element>) => {
        const currentIdx = items.indexOf(activeItem);
        if (currentIdx === -1) return;
        const nextIdx = getRovingNextIndex(e.key, currentIdx, items.length, {
            withHomeEnd,
        });
        if (nextIdx === null) return;
        e.preventDefault();
        const next = items[nextIdx];
        onChange(next);
        focusItem(next, e);
    };
}
