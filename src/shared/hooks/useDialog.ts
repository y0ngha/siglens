'use client';

import {
    type RefObject,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';

interface UseDialogReturn {
    isOpen: boolean;
    open: () => void;
    close: () => void;
    /** 네이티브 `<dialog>` 엘리먼트 ref — `showModal()`/`close()`를 이 훅이 호출한다. */
    dialogRef: RefObject<HTMLDialogElement | null>;
    triggerRef: RefObject<HTMLButtonElement | null>;
}

/**
 * 네이티브 `<dialog>` 모달 제어.
 *
 * 예전에는 div + role="dialog"에 포커스 트랩(useFocusTrap) · Esc(useEscapeKey) ·
 * 바깥 클릭(useOnClickOutside)을 직접 붙였다. `showModal()`로 열면 그 셋이 전부
 * 브라우저 기본 동작으로 대체된다 — 포커스는 다이얼로그 안에 갇히고, Esc는 close를
 * 발생시키며, ::backdrop이 하위 콘텐츠를 비활성화한다. 직접 구현한 트랩이 어긋나
 * 키보드 사용자가 모달 밖으로 탭 아웃되는 부류의 버그가 구조적으로 사라진다.
 *
 * 소비자는 `<dialog ref={dialogRef} onClose={close}>`를 항상 렌더하기만 하면 된다 —
 * 열고 닫기, 배경(::backdrop) 클릭 닫기는 이 훅이 dialog 엘리먼트에 직접 처리한다.
 */
export function useDialog(): UseDialogReturn {
    const [isOpen, setIsOpen] = useState(false);
    const dialogRef = useRef<HTMLDialogElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    // 마운트 직후(닫힌 상태)의 effect에서 트리거로 포커스를 훔치지 않도록,
    // "한 번이라도 열렸는지"를 기억한다.
    const wasOpenRef = useRef(false);

    const open = useCallback(() => setIsOpen(true), []);
    const close = useCallback(() => setIsOpen(false), []);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (isOpen) {
            wasOpenRef.current = true;
            if (dialog === null) return;
            // 이미 열려 있으면 재호출하지 않는다(showModal 중복 호출은 예외를 던진다).
            if (!dialog.open) dialog.showModal();

            // 배경(::backdrop) 클릭으로 닫기 — 배경 클릭은 dialog 엘리먼트 자신에게
            // 도달한다. JSX의 onClick으로 붙이면 소비자마다 같은 코드를 반복하게 되고
            // "비인터랙티브 요소에 클릭 핸들러" a11y 지적도 각 소비자에서 발생하므로
            // 여기서 한 번만 처리한다.
            const onBackdropClick = (event: MouseEvent): void => {
                if (event.target === dialog) setIsOpen(false);
            };
            dialog.addEventListener('click', onBackdropClick);
            return () => dialog.removeEventListener('click', onBackdropClick);
        }
        if (dialog !== null && dialog.open) dialog.close();
        if (!wasOpenRef.current) return;
        wasOpenRef.current = false;
        // 닫힌 뒤 포커스를 트리거로 되돌린다. 네이티브도 대개 복원하지만, dialog를
        // 조건부 렌더하는 소비자(언마운트로 닫는 경우)까지 보장하려면 명시해야 한다.
        triggerRef.current?.focus();
    }, [isOpen]);

    return { isOpen, open, close, dialogRef, triggerRef };
}
