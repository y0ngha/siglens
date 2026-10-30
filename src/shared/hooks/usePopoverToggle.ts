'use client';

import { type RefObject, useState } from 'react';
import { useOnClickOutside } from '@/shared/hooks/useOnClickOutside';

interface UsePopoverToggleReturn {
    isOpen: boolean;
    open: () => void;
    close: () => void;
    toggle: () => void;
}

/**
 * 열림 상태 + `refs` 바깥 `pointerdown` 시 닫기. 열려 있는 동안에만 바깥 클릭 리스너를 단다.
 */
export function usePopoverToggle(
    refs: RefObject<HTMLElement | null> | RefObject<HTMLElement | null>[]
): UsePopoverToggleReturn {
    const [isOpen, setIsOpen] = useState(false);

    useOnClickOutside(refs, () => setIsOpen(false), { enabled: isOpen });

    const open = () => setIsOpen(true);
    const close = () => setIsOpen(false);
    const toggle = () => setIsOpen(prev => !prev);

    return { isOpen, open, close, toggle };
}
