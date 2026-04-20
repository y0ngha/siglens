'use client';

import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type RefObject,
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

    // 커스텀 훅은 인라인 콜백을 받는다. 외부용 handler(아래 useCallback)는 hook 선언 이후에 둔다.
    useOnClickOutside(
        [dialogRef],
        () => {
            setIsOpen(false);
            triggerRef.current?.focus();
        },
        { enabled: isOpen }
    );
    useEscapeKey(() => {
        setIsOpen(false);
        triggerRef.current?.focus();
    }, isOpen);
    useFocusTrap(dialogRef, isOpen);

    const open = useCallback(() => setIsOpen(true), []);
    const close = useCallback(() => {
        setIsOpen(false);
        triggerRef.current?.focus();
    }, []);

    useEffect(() => {
        if (isOpen) dialogRef.current?.focus();
    }, [isOpen]);

    return { isOpen, open, close, dialogRef, triggerRef };
}
