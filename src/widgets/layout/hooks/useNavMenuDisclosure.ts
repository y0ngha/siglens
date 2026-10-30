'use client';

import {
    useRef,
    useState,
    type RefObject,
    type FocusEvent as ReactFocusEvent,
    type PointerEvent as ReactPointerEvent,
} from 'react';
import { useOnClickOutside } from '@/shared/hooks/useOnClickOutside';
import { useEscapeDismiss } from './useEscapeDismiss';

interface UseNavMenuDisclosureResult {
    readonly isOpen: boolean;
    readonly close: () => void;
    readonly containerRef: RefObject<HTMLDivElement | null>;
    readonly triggerRef: RefObject<HTMLButtonElement | null>;
    readonly onTriggerClick: () => void;
    readonly onPointerEnter: (event: ReactPointerEvent) => void;
    readonly onPointerLeave: (event: ReactPointerEvent) => void;
    readonly onBlur: (event: ReactFocusEvent<HTMLElement>) => void;
}

/** 메뉴가 무엇으로 열렸는지. 호버로 열린 메뉴를 클릭하면 `click`으로 고정된다. */
type OpenSource = 'hover' | 'click';

/**
 * 헤더 드롭다운 1개의 열림 상태와 이벤트 핸들러.
 *
 * - **호버**: 마우스 포인터가 들어오면 열고, 나가면 닫는다(클릭으로 고정된 메뉴는 제외).
 *   마우스 포인터만 해당한다. 터치는 탭 한 번이 pointerenter → click 순서로
 *   둘 다 발생하므로, 호버가 열고 클릭 토글이 곧바로 닫아 메뉴가 열리지 않는다. 펜도 같다.
 * - **클릭**: 닫혀 있거나 호버로 열려 있으면 열고 **고정**한다 — 사용자가 열어 두려고 누른
 *   것이므로 포인터가 나가도 닫지 않는다. 고정된 메뉴는 다시 클릭, Escape, 바깥 클릭, 포커스
 *   이탈로만 닫힌다.
 * - **포커스 이탈**: 포커스가 컨테이너 밖 요소로 옮겨가면 닫는다. 키보드로 트리거를 지나갈 때
 *   패널이 여러 개 열린 채 남는 것을 막는다. 창 전환처럼 도착 요소가 없는 blur는 무시한다.
 * - **Escape**: 항상 닫고, 포커스가 메뉴 안에 있었을 때만 트리거로 되돌린다.
 */
export function useNavMenuDisclosure(): UseNavMenuDisclosureResult {
    const [openedBy, setOpenedBy] = useState<OpenSource | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    // HK-1 예외: `isOpen`·`close`는 아래 훅들(`useEscapeDismiss`·`useOnClickOutside`)의 입력이라
    // 그 훅보다 먼저 선언한다.
    const isOpen = openedBy !== null;

    const close = () => setOpenedBy(null);

    useEscapeDismiss({
        containerRef,
        triggerRef,
        enabled: isOpen,
        onClose: close,
    });
    // `pointerdown`은 클릭이 완료되기 전에 발생해, 다른 트리거를 눌렀을 때
    // "이전 것 닫기 → 새 것 열기"가 한 번의 상호작용으로 끝난다.
    useOnClickOutside(containerRef, close, { enabled: isOpen });

    const onTriggerClick = () =>
        setOpenedBy(current => (current === 'click' ? null : 'click'));

    const onPointerEnter = (event: ReactPointerEvent) => {
        if (event.pointerType === 'mouse')
            setOpenedBy(current => current ?? 'hover');
    };

    const onPointerLeave = (event: ReactPointerEvent) => {
        if (event.pointerType !== 'mouse') return;
        setOpenedBy(current => (current === 'click' ? current : null));
    };

    const onBlur = (event: ReactFocusEvent<HTMLElement>) => {
        const next = event.relatedTarget;
        if (next instanceof Node && !event.currentTarget.contains(next))
            close();
    };

    return {
        isOpen,
        close,
        containerRef,
        triggerRef,
        onTriggerClick,
        onPointerEnter,
        onPointerLeave,
        onBlur,
    };
}
