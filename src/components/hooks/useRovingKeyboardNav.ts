'use client';

import { useCallback, type KeyboardEvent } from 'react';
import { getRovingNextIndex } from '@/lib/rovingKeyboardNav';

interface UseRovingKeyboardNavOptions<T> {
    items: readonly T[];
    activeItem: T;
    onChange: (next: T) => void;
    focusItem: (next: T, e: KeyboardEvent<Element>) => void;
    withHomeEnd?: boolean;
}

// Arrow L/R (기본) + Home/End (옵션) 기반 roving tabindex/radiogroup 키 내비게이션.
// focusItem은 next 아이템으로 포커스 이동 방식을 caller가 결정할 수 있게 한다
// (ref 기반 또는 DOM 질의 기반). caller는 focusItem/onChange를 useCallback으로 안정화하는 것이 좋다.
export function useRovingKeyboardNav<T>({
    items,
    activeItem,
    onChange,
    focusItem,
    withHomeEnd = true,
}: UseRovingKeyboardNavOptions<T>): (e: KeyboardEvent<Element>) => void {
    return useCallback(
        (e: KeyboardEvent<Element>) => {
            const currentIdx = items.indexOf(activeItem);
            if (currentIdx === -1) return;
            const nextIdx = getRovingNextIndex(
                e.key,
                currentIdx,
                items.length,
                { withHomeEnd }
            );
            if (nextIdx === null) return;
            e.preventDefault();
            const next = items[nextIdx];
            onChange(next);
            focusItem(next, e);
        },
        [items, activeItem, onChange, focusItem, withHomeEnd]
    );
}
