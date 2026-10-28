'use client';

import {
    startTransition,
    useEffect,
    useEffectEvent,
    useRef,
    useState,
} from 'react';
import { useBodyScrollLock } from '@/shared/hooks/useBodyScrollLock';
import { useEscapeLayer } from '@/shared/hooks/useEscapeLayer';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { useCloseAtDesktop } from './useCloseAtDesktop';

/**
 * 모바일 드로어의 열림 상태와 부수 효과 일체 — 포커스 트랩·스크롤 잠금·Escape·경로 변경·
 * 데스크톱 폭 전환 시 닫기.
 *
 * `pathname`이 바뀌면 닫는다. 링크 클릭은 `close`를 직접 부르지만 뒤로가기·앞으로가기
 * 같은 히스토리 이동은 그 핸들러를 건너뛰어, 닫지 않으면 스크롤이 잠긴 채 드로어가 남는다.
 * 닫힌 상태에서는 포커스를 건드리지 않는다(마운트 직후 트리거 포커스 탈취 방지).
 */
export function useMobileDrawer(pathname: string | null) {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const drawerRef = useRef<HTMLDivElement>(null);

    const close = () => {
        setIsOpen(false);
        triggerRef.current?.focus();
    };
    const toggle = () => setIsOpen(open => !open);

    useEscapeLayer(close, isOpen);
    useFocusTrap(drawerRef, isOpen);
    useBodyScrollLock(isOpen);
    // 트리거가 숨겨지는 폭으로 넘어간 것이므로 `close`(트리거 포커스)를 거치지 않는다.
    // 포커스 트랩의 해제 정리가 햄버거로 포커스 복원을 시도하지만, `display: none`인 요소는
    // 포커스를 받지 못해 실제로는 아무 일도 일어나지 않는다.
    useCloseAtDesktop(isOpen, () => setIsOpen(false));

    // `startTransition`은 react/set-state-in-effect 린트를 만족시키기 위한 것이다
    // (REACT.md#EF-1) — `useEffectEvent` 본문의 setState도 같은 규칙이 추적한다.
    const closeOnNavigate = useEffectEvent(() => {
        if (!isOpen) return;
        startTransition(close);
    });
    useEffect(() => {
        closeOnNavigate();
    }, [pathname]);

    return { isOpen, triggerRef, drawerRef, close, toggle };
}
