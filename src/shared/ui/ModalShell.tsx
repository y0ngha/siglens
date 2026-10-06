'use client';

import { type ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { cn } from '@/shared/lib/cn';

interface ModalShellProps {
    /** 패널을 이름 짓는 제목 요소의 id(`aria-labelledby`). 제목은 children 안에 둔다. */
    titleId: string;
    /** 본문 설명 요소의 id(`aria-describedby`). 안내형 모달이 사정을 함께 읽히게 한다. */
    descriptionId?: string;
    onClose: () => void;
    /**
     * 열릴 때 패널 자체에 포커스를 둔다. 안내만 담은 모달(가입 유도 등)은 첫 컨트롤(CTA)에
     * 포커스가 가면 스크린리더가 본문을 건너뛰고 버튼부터 읽는다. 기본은 첫 조작 요소.
     */
    focusPanel?: boolean;
    /** 패널 전체가 진행 중일 때 `aria-busy`(공유 준비 모달의 대기 단계). */
    busy?: boolean;
    /** 패널 표면(배경·경계·패딩·폭). 오버레이는 모든 모달이 같다. */
    className?: string;
    children: ReactNode;
}

/**
 * 조건부로 마운트되는 모달의 공통 뼈대 — 오버레이, `role="dialog"` 패널, 포커스 트랩,
 * Esc·배경 클릭 닫기. 마운트 = 열림이다. 트리거와 함께 늘 렌더되는 모달은
 * 네이티브 `<dialog>`를 쓰는 `useDialog`가 맞다.
 *
 * 배경 클릭은 target 비교로 처리한다 — 패널 안 클릭마다 `stopPropagation`을 달지 않으려고.
 * 오버레이는 장식(`role="presentation"`)이고, 키보드 닫기 경로는 Esc다.
 *
 * `document.body`로 portal한다. 모달은 페이지 본문 안에서 마운트되는데, 본문은
 * sticky 헤더(z-50)와 다른 stacking context라 오버레이의 z-index를 아무리 올려도
 * 헤더와 플로팅 버튼 위로 올라가지 못했다(배경이 헤더를 덮지 못함). React context는
 * portal을 그대로 통과하므로 번역·쿼리 프로바이더는 그대로 쓸 수 있다.
 * 조건부 마운트(= 사용자 조작 뒤)라 SSR에서 열린 채 렌더되지 않지만, 가드는 명시한다.
 */
export function ModalShell({
    titleId,
    descriptionId,
    onClose,
    focusPanel = false,
    busy,
    className,
    children,
}: ModalShellProps) {
    const panelRef = useRef<HTMLDivElement>(null);

    useFocusTrap(panelRef, true);
    useEscapeKey(onClose, true);

    // useFocusTrap이 첫 조작 요소로 옮긴 포커스를 패널로 되가져온다(선언 순서상 뒤에 실행).
    useEffect(() => {
        if (focusPanel) panelRef.current?.focus();
    }, [focusPanel]);

    if (typeof document === 'undefined') return null;

    return createPortal(
        <div
            role="presentation"
            data-testid="modal-backdrop"
            className="fixed inset-0 z-9999 flex items-center justify-center bg-secondary-950/80 p-4 backdrop-blur-sm"
            onClick={e => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                aria-busy={busy ? 'true' : undefined}
                tabIndex={-1}
                className={cn('w-full rounded-lg outline-none', className)}
            >
                {children}
            </div>
        </div>,
        document.body
    );
}
