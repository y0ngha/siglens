'use client';

import {
    type RefObject,
    useCallback,
    useEffect,
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

    // close는 useOnClickOutside/useEscapeKey에 전달하기 위해 훅 선언 이전에 배치한다.
    // setIsOpen(setState)과 triggerRef는 렌더 간 안정적이므로 deps 배열이 비어 있어도 안전하다.
    const close = useCallback(() => {
        setIsOpen(false);
        triggerRef.current?.focus();
    }, []);

    useOnClickOutside([dialogRef], close, { enabled: isOpen });
    useEscapeKey(close, isOpen);
    useFocusTrap(dialogRef, isOpen);

    const open = useCallback(() => setIsOpen(true), []);

    useEffect(() => {
        if (isOpen) dialogRef.current?.focus();
    }, [isOpen]);

    return { isOpen, open, close, dialogRef, triggerRef };
}
