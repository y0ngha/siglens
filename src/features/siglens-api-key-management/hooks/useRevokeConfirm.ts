'use client';

import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type RefObject,
} from 'react';

/** 키 행의 "폐기 → 확인" 두 단계 상태와 포커스를 받을 두 버튼의 ref. */
export interface RevokeConfirmControl {
    /** 확인 단계(폐기하기·취소)가 열려 있는가. */
    confirming: boolean;
    /** "폐기"를 눌러 확인 단계를 연다. 참조가 안정적이다. */
    startConfirm: () => void;
    /** 확인 단계를 닫는다(취소). 참조가 안정적이다. */
    cancelConfirm: () => void;
    revokeButtonRef: RefObject<HTMLButtonElement | null>;
    confirmButtonRef: RefObject<HTMLButtonElement | null>;
}

/**
 * 폐기를 바로 제출하지 않고 한 번 더 묻는 확인 단계를 관리한다.
 *
 * 단계가 바뀌면 누른 버튼이 사라지므로 포커스를 다음 버튼으로 옮긴다 — 열리면 "폐기하기",
 * 취소로 닫히면 "폐기". 옮기지 않으면 포커스가 `<body>`로 떨어진다. 첫 렌더와 같은 단계에서는
 * 움직이지 않아 페이지를 열 때 포커스를 빼앗지 않고, Strict Mode의 이중 effect에서도 한 번만 옮긴다.
 */
export function useRevokeConfirm(): RevokeConfirmControl {
    const [confirming, setConfirming] = useState(false);
    const revokeButtonRef = useRef<HTMLButtonElement>(null);
    const confirmButtonRef = useRef<HTMLButtonElement>(null);
    const focusedStepRef = useRef(confirming);

    const startConfirm = useCallback(() => setConfirming(true), []);
    const cancelConfirm = useCallback(() => setConfirming(false), []);

    useEffect(() => {
        if (focusedStepRef.current === confirming) return;
        focusedStepRef.current = confirming;
        const target = confirming ? confirmButtonRef : revokeButtonRef;
        target.current?.focus();
    }, [confirming]);

    return {
        confirming,
        startConfirm,
        cancelConfirm,
        revokeButtonRef,
        confirmButtonRef,
    };
}
