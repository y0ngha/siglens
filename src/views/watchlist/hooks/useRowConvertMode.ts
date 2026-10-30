'use client';

import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type RefObject,
} from 'react';

/** 행의 "보유로 전환" 모드 상태와 포커스를 옮길 두 지점. */
export interface UseRowConvertModeResult {
    isConverting: boolean;
    /** 전환 폼을 연다. 폼이 그려지면 첫 입력칸으로 포커스가 들어간다. */
    open: () => void;
    /** 전환 폼을 닫는다. 행이 남아 있으면 포커스가 "보유로 전환" 버튼으로 돌아온다. */
    close: () => void;
    /** 행(`<li>`)에 거는 콜백 ref. `observeRow`(뷰포트 감지)에도 같은 노드를 넘긴다. */
    setRow: (node: HTMLLIElement | null) => void;
    /** "보유로 전환" 버튼 ref — 폼을 닫은 뒤 포커스가 돌아갈 곳. */
    triggerRef: RefObject<HTMLButtonElement | null>;
}

/**
 * 관심 행의 "보유로 전환" 모드. 버튼과 폼이 서로를 갈아 끼우므로 그대로 두면 포커스가 `<body>`로
 * 떨어진다 — 키보드 사용자가 폼을 찾아 처음부터 Tab을 다시 눌러야 한다. 그래서 열면 폼의 첫
 * 입력칸으로, 닫으면 여는 버튼으로 포커스를 옮긴다. 폼은 `HoldingForm`이 그리므로 입력칸은
 * 행 노드 안에서 찾는다. 전환에 성공해 행 자체가 사라지면 이 훅은 함께 언마운트되므로, 그때의
 * 포커스는 목록 쪽(`useRemovedRowFocus`)이 옆 행으로 옮긴다.
 */
export function useRowConvertMode(
    observeRow: (node: HTMLLIElement | null) => void
): UseRowConvertModeResult {
    const [isConverting, setIsConverting] = useState(false);
    const rowRef = useRef<HTMLLIElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    // 닫힘이 사용자의 닫기에서 왔을 때만 포커스를 돌려준다(첫 마운트에는 옮기지 않는다).
    const returnFocusRef = useRef(false);

    const setRow = useCallback(
        (node: HTMLLIElement | null) => {
            rowRef.current = node;
            observeRow(node);
        },
        [observeRow]
    );

    const open = (): void => setIsConverting(true);
    const close = (): void => {
        returnFocusRef.current = true;
        setIsConverting(false);
    };

    useEffect(() => {
        if (isConverting) {
            rowRef.current?.querySelector<HTMLInputElement>('input')?.focus();
            return;
        }
        if (!returnFocusRef.current) return;
        returnFocusRef.current = false;
        triggerRef.current?.focus();
    }, [isConverting]);

    return { isConverting, open, close, setRow, triggerRef };
}
