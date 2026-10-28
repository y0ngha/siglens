'use client';

import { useRef } from 'react';
import { usePopoverToggle } from '@/shared/hooks/usePopoverToggle';
import { useEscapeDismiss } from './useEscapeDismiss';

/**
 * 클릭으로 여닫는 팝오버의 공통 동작 — 바깥 클릭·Escape 닫기와 Escape 시 포커스 복원.
 *
 * `containerRef`는 트리거와 팝오버를 함께 감싸는 요소에, `triggerRef`는 토글 버튼에 단다.
 */
export function usePopoverDisclosure() {
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const { isOpen, close, toggle } = usePopoverToggle(containerRef);
    useEscapeDismiss({
        containerRef,
        triggerRef,
        enabled: isOpen,
        onClose: close,
    });
    return { containerRef, triggerRef, isOpen, close, toggle };
}
