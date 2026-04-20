'use client';

import { useCallback, useState, type RefObject } from 'react';
import { useOnClickOutside } from '@/components/hooks/useOnClickOutside';

interface PopoverToggle {
    isOpen: boolean;
    open: () => void;
    close: () => void;
    toggle: () => void;
}

export function usePopoverToggle(
    refs: RefObject<HTMLElement | null> | RefObject<HTMLElement | null>[]
): PopoverToggle {
    const [isOpen, setIsOpen] = useState(false);

    useOnClickOutside(refs, () => setIsOpen(false), { enabled: isOpen });

    const open = useCallback(() => setIsOpen(true), []);
    const close = useCallback(() => setIsOpen(false), []);
    const toggle = useCallback(() => setIsOpen(prev => !prev), []);

    return { isOpen, open, close, toggle };
}
