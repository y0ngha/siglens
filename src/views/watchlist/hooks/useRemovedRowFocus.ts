'use client';

import { useCallback, useEffect, useRef, type RefObject } from 'react';

/** 행을 지우는 함수와, 지운 행 대신 포커스를 받을 두 지점. */
export interface UseRemovedRowFocusResult {
    /** `remove`와 같다. 이 함수로 지운 행이 사라지면 포커스를 옆 행(또는 빈 상태)으로 옮긴다. */
    remove: (symbol: string) => Promise<boolean>;
    /** 행 목록(`<ul>`). 직계 자식이 `symbols` 순서의 행(`<li>`)이어야 한다. */
    listRef: RefObject<HTMLUListElement | null>;
    /** 목록이 비었을 때 포커스를 받을 빈 상태 안내 문장(`tabIndex={-1}`). */
    emptyStateRef: RefObject<HTMLParagraphElement | null>;
}

/** 사라진 행 자리(`index`)의 다음 행, 그게 없으면 이전 행의 첫 링크. 행이 하나도 없으면 null. */
function neighborLink(
    list: HTMLUListElement | null,
    index: number
): HTMLElement | null {
    if (list === null || list.children.length === 0) return null;
    const row =
        list.children[Math.min(index, list.children.length - 1)] ?? null;
    return row?.querySelector<HTMLElement>('a') ?? null;
}

/**
 * 관심 행 삭제(삭제 버튼·보유로 전환) 뒤의 포커스. 누른 버튼이 행과 함께 언마운트되므로 그대로
 * 두면 포커스가 `<body>`로 떨어져, 키보드 사용자가 목록을 처음부터 다시 Tab해야 한다. 그래서 이
 * 훅의 `remove`로 지운 행이 목록에서 사라지는 커밋에 다음 행(마지막이었으면 이전 행)의 종목
 * 링크로, 목록이 비면 빈 상태 안내로 포커스를 옮긴다.
 *
 * 회원 삭제는 낙관적 갱신이라 `remove`가 끝나기 전에 행이 먼저 사라진다 — 그래서 "지울 행"을
 * 호출 직전에 표시해 두고, 행이 실제로 사라진 커밋(effect)에서 처리한다. 다른 탭 동기화처럼
 * 이 훅을 거치지 않은 삭제에는 포커스를 건드리지 않는다. 삭제가 실패해 행이 남으면 표시를
 * 지우고, 포커스는 행 쪽(전환 폼 닫기)이 돌려준다.
 */
export function useRemovedRowFocus(
    symbols: readonly string[],
    removeRow: (symbol: string) => Promise<boolean>
): UseRemovedRowFocusResult {
    const listRef = useRef<HTMLUListElement | null>(null);
    const emptyStateRef = useRef<HTMLParagraphElement | null>(null);
    // 이 훅의 `remove`로 지우는 중인 심볼. 그 행이 사라진 커밋에서 한 번만 소비한다.
    const removingRef = useRef<string | null>(null);
    // 직전 커밋의 행 순서 — 사라진 행이 몇 번째였는지 알아야 옆 행을 고른다.
    const previousSymbolsRef = useRef<readonly string[]>(symbols);

    const remove = useCallback(
        async (symbol: string): Promise<boolean> => {
            removingRef.current = symbol;
            const removed = await removeRow(symbol);
            if (!removed && removingRef.current === symbol) {
                removingRef.current = null;
            }
            return removed;
        },
        [removeRow]
    );

    useEffect(() => {
        const previous = previousSymbolsRef.current;
        previousSymbolsRef.current = symbols;
        const removing = removingRef.current;
        if (removing === null || symbols.includes(removing)) return;
        removingRef.current = null;
        const index = previous.indexOf(removing);
        if (index === -1) return;
        const target =
            neighborLink(listRef.current, index) ?? emptyStateRef.current;
        target?.focus();
    }, [symbols]);

    return { remove, listRef, emptyStateRef };
}
