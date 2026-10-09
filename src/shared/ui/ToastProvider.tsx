'use client';

import {
    createContext,
    use,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { TOAST_AUTO_DISMISS_MS } from '@/shared/config/toast';
import { Toast, type ToastContent } from './Toast';

interface ToastContextValue {
    showToast: (toast: ToastContent) => void;
    dismiss: () => void;
}

interface ActiveToast extends ToastContent {
    /** 타이머 effect의 유일한 dep — 객체가 아니라 숫자다(등록 effect deps에 객체 금지). */
    id: number;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * 앱 전체에 토스트는 **한 번에 하나**다. 새 토스트가 오면 이전 것을 교체하고 자동 닫힘
 * 타이머를 다시 시작한다. 루트 레이아웃(`[locale]/layout.tsx`)이 한 번 마운트한다 —
 * 종목 헤더 ☆, 병합 호스트, 내 종목 섹션이 같은 인스턴스를 쓴다.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
    const [toast, setToast] = useState<ActiveToast | null>(null);
    const nextIdRef = useRef(0);

    const showToast = useCallback((content: ToastContent) => {
        nextIdRef.current += 1;
        setToast({ ...content, id: nextIdRef.current });
    }, []);
    const dismiss = useCallback(() => setToast(null), []);
    const value = useMemo(() => ({ showToast, dismiss }), [showToast, dismiss]);

    const toastId = toast?.id ?? null;
    useEffect(() => {
        if (toastId === null) return;
        const handle = setTimeout(() => setToast(null), TOAST_AUTO_DISMISS_MS);
        return () => clearTimeout(handle);
    }, [toastId]);

    return (
        <ToastContext value={value}>
            {children}
            <Toast toast={toast} onDismiss={dismiss} />
        </ToastContext>
    );
}

export function useToast(): ToastContextValue {
    const value = use(ToastContext);
    if (value === null) {
        throw new Error('useToast must be used within <ToastProvider>');
    }
    return value;
}
