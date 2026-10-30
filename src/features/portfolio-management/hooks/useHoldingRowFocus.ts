'use client';

import { useEffect, useRef } from 'react';
import { isFocusLost } from '../lib/isFocusLost';

/** `useHoldingRowFocus`가 지켜보는 행의 두 모드. */
export interface HoldingRowFocusState {
    isEditing: boolean;
    isConfirmingDelete: boolean;
}

/** 행 버튼에 붙일 ref. 모드가 바뀔 때 이 버튼들로 포커스를 넘긴다. */
export interface HoldingRowFocusRefs {
    editButtonRef: React.RefObject<HTMLButtonElement | null>;
    deleteButtonRef: React.RefObject<HTMLButtonElement | null>;
    confirmDeleteButtonRef: React.RefObject<HTMLButtonElement | null>;
}

/**
 * 보유종목 행이 버튼을 갈아 끼울 때 포커스가 `<body>`로 떨어지지 않게 한 번 옮긴다. 대화상자가
 * 아니라 행 안의 컨트롤 교체라 포커스를 가두지는 않는다.
 *
 * - 삭제 확인에 들어가면 "삭제 확정"으로 옮긴다.
 * - 삭제 확인이나 인라인 편집에서 나오면 각각 "삭제"·"수정"으로 되돌린다. 단, 포커스가 이미
 *   다른 곳(다른 행의 버튼·편집 폼)에 가 있으면 건드리지 않는다 — 다른 행을 누르면 이 행이
 *   함께 모드를 벗어나는데, 형제 effect의 실행 순서에 따라 그 행의 포커스를 빼앗게 된다.
 * - 마운트 때는 아무것도 옮기지 않는다(이전 모드를 마운트 시점 값으로 시작한다).
 */
export function useHoldingRowFocus({
    isEditing,
    isConfirmingDelete,
}: HoldingRowFocusState): HoldingRowFocusRefs {
    const editButtonRef = useRef<HTMLButtonElement>(null);
    const deleteButtonRef = useRef<HTMLButtonElement>(null);
    const confirmDeleteButtonRef = useRef<HTMLButtonElement>(null);
    const wasConfirmingDeleteRef = useRef(isConfirmingDelete);
    const wasEditingRef = useRef(isEditing);

    useEffect(() => {
        const wasConfirming = wasConfirmingDeleteRef.current;
        wasConfirmingDeleteRef.current = isConfirmingDelete;
        if (isConfirmingDelete && !wasConfirming) {
            confirmDeleteButtonRef.current?.focus();
            return;
        }
        if (!isConfirmingDelete && wasConfirming && isFocusLost()) {
            deleteButtonRef.current?.focus();
        }
    }, [isConfirmingDelete]);

    useEffect(() => {
        const wasEditing = wasEditingRef.current;
        wasEditingRef.current = isEditing;
        if (!isEditing && wasEditing && isFocusLost()) {
            editButtonRef.current?.focus();
        }
    }, [isEditing]);

    return { editButtonRef, deleteButtonRef, confirmDeleteButtonRef };
}
