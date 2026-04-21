'use client';

import {
    type RefObject,
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from 'react';
import { useEscapeKey } from '@/components/hooks/useEscapeKey';
import { useOnClickOutside } from '@/components/hooks/useOnClickOutside';
import { useFocusTrap } from '@/components/layout/hooks/useFocusTrap';

interface UseDialogReturn {
    isOpen: boolean;
    open: () => void;
    close: () => void;
    dialogRef: RefObject<HTMLDivElement | null>;
    triggerRef: RefObject<HTMLButtonElement | null>;
}

export function useDialog(): UseDialogReturn {
    const [isOpen, setIsOpen] = useState(false);
    const dialogRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    // closeRef provides a stable target for hooks that must be declared before close
    const closeRef = useRef<() => void>(() => {});

    useOnClickOutside([dialogRef], () => closeRef.current(), {
        enabled: isOpen,
    });
    useEscapeKey(() => closeRef.current(), isOpen);
    useFocusTrap(dialogRef, isOpen);

    const close = useCallback(() => {
        setIsOpen(false);
        triggerRef.current?.focus();
    }, []);

    useLayoutEffect(() => {
        closeRef.current = close;
    }, [close]);

    const open = useCallback(() => setIsOpen(true), []);

    useEffect(() => {
        if (isOpen) dialogRef.current?.focus();
    }, [isOpen]);

    return { isOpen, open, close, dialogRef, triggerRef };
}
