'use client';

import { type RefObject } from 'react';
import { useEscapeLayer } from '@/shared/hooks/useEscapeLayer';
import { isFocusWithin } from '../utils/isFocusWithin';

interface UseEscapeDismissOptions {
    /** 트리거와 팝오버를 함께 감싸는 컨테이너. 포커스가 이 안에 있는지로 복원 여부를 가른다. */
    readonly containerRef: RefObject<HTMLElement | null>;
    readonly triggerRef: RefObject<HTMLElement | null>;
    readonly enabled: boolean;
    readonly onClose: () => void;
}

/**
 * Escape로 팝오버를 닫고, 포커스가 팝오버 안에 있었을 때만 트리거로 되돌린다.
 *
 * 닫히면 포커스가 있던 요소가 사라져 `body`로 떨어지므로 키보드 사용자는 위치를 잃는다.
 * 반대로 마우스 호버로만 열린 팝오버는 포커스가 다른 곳(검색창)에 있을 수 있어,
 * 무조건 되돌리면 그 입력을 가로챈다. 닫기는 항상 한다.
 *
 * 중첩 레이어(드로어 안의 팝오버)에서는 가장 안쪽만 반응한다(`useEscapeLayer`).
 */
export function useEscapeDismiss({
    containerRef,
    triggerRef,
    enabled,
    onClose,
}: UseEscapeDismissOptions): void {
    useEscapeLayer(() => {
        const restoreFocus = isFocusWithin(containerRef.current);
        onClose();
        if (restoreFocus) triggerRef.current?.focus();
    }, enabled);
}
