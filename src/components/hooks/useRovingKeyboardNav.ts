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

// Arrow L/R + Home/End 기반 roving tabindex 내비게이션 — focusItem/onChange는 useCallback으로 안정화 필요.
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
