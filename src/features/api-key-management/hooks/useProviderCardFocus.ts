'use client';

import { useEffect, useEffectEvent, useRef, type RefObject } from 'react';

interface UseProviderCardFocusOptions {
    /** 카드가 키 입력 폼을 펼친 상태인가. */
    showSaveInput: boolean;
    /**
     * 지금 포커스를 이어받아야 하는가. 저장·삭제가 성공해 등록 여부가 바뀌면 카드가
     * 새로 마운트되는데, 그 새 카드에서만 `true`다. 마운트 시점에 이미 `true`일
     * 수도, 마운트 뒤에 `true`가 될 수도 있다 — 액션 성공과 목록 갱신 중 어느
     * 쪽이 먼저 커밋되든 넘겨받는다.
     */
    restoreFocus: boolean;
    /**
     * 포커스를 넘겨받은 직후 부른다. 부모는 여기서 요청을 지워, 이 카드의 조작과
     * 무관한 이후 재마운트(다른 탭의 변경으로 인한 갱신 등)가 포커스를 빼앗지
     * 않게 한다.
     */
    onFocusRestored: () => void;
}

/** 카드가 모드를 바꿀 때 포커스를 받을 두 컨트롤의 ref. */
interface ProviderCardFocusRefs {
    inputRef: RefObject<HTMLInputElement | null>;
    reRegisterRef: RefObject<HTMLButtonElement | null>;
}

/**
 * 카드의 입력 폼이 열리고 닫힐 때 포커스를 다음 컨트롤로 옮긴다.
 *
 * '재등록'·'취소'·'저장'을 누르면 누른 버튼이 사라진다. 그대로 두면 포커스가
 * `<body>`로 떨어져 키보드 사용자가 페이지 처음부터 다시 Tab을 눌러야 한다.
 * 폼이 열리면 키 입력칸, 닫히면 '재등록' 버튼으로 보낸다.
 *
 * 모드 전환은 첫 렌더와 같은 값이면 아무것도 하지 않는다 — 페이지를 처음 열 때
 * 포커스를 빼앗지 않고, Strict Mode의 이중 effect 실행에서도 한 번만 옮긴다.
 * 재마운트로 인한 이어받기는 `restoreFocus`가 따로 맡는다.
 */
export function useProviderCardFocus({
    showSaveInput,
    restoreFocus,
    onFocusRestored,
}: UseProviderCardFocusOptions): ProviderCardFocusRefs {
    const inputRef = useRef<HTMLInputElement>(null);
    const reRegisterRef = useRef<HTMLButtonElement>(null);
    const focusedModeRef = useRef(showSaveInput);
    // 부모가 인라인 화살표를 넘기므로 effect 의존성에 두면 렌더마다 다시 돈다.
    const notifyFocusRestored = useEffectEvent(onFocusRestored);

    useEffect(() => {
        if (focusedModeRef.current === showSaveInput) return;
        focusedModeRef.current = showSaveInput;
        const target = showSaveInput ? inputRef : reRegisterRef;
        target.current?.focus();
    }, [showSaveInput]);

    useEffect(() => {
        if (!restoreFocus) return;
        focusedModeRef.current = showSaveInput;
        const target = showSaveInput ? inputRef : reRegisterRef;
        target.current?.focus();
        notifyFocusRestored();
    }, [restoreFocus, showSaveInput]);

    return { inputRef, reRegisterRef };
}
