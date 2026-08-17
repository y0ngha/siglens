'use client';

import { type RefObject, useState } from 'react';
import { useOnClickOutside } from '@/shared/hooks/useOnClickOutside';

interface UsePopoverToggleReturn {
    isOpen: boolean;
    open: () => void;
    close: () => void;
    toggle: () => void;
}

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
