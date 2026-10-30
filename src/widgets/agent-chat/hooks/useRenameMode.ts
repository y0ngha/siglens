'use client';

/**
 * 대화 이름 바꾸기 편집 상태 훅 — 편집 중인 행·입력값, 입력 포커스, 바깥 클릭 취소, 포커스 복귀.
 */
import { useEffect, useRef, useState, type RefObject } from 'react';
import { useOnClickOutside } from '@/shared/hooks/useOnClickOutside';

interface RenameDraft {
    id: string;
    title: string;
}

interface UseRenameModeReturn {
    draft: RenameDraft | null;
    /** 편집을 연다. 연 버튼을 기억해 닫을 때 포커스를 돌려준다. */
    open: (id: string, title: string, trigger: HTMLButtonElement) => void;
    change: (title: string) => void;
    /** 편집을 닫고 포커스를 연 버튼으로 돌려준다. */
    close: () => void;
    /** 편집 중인 행 — 이 밖을 누르면 취소된다. */
    rowRef: RefObject<HTMLLIElement | null>;
    inputRef: RefObject<HTMLInputElement | null>;
}

/**
 * - 편집 중인 행 **밖을 누르면** 취소한다. 입력의 `blur`로 취소하지 않는다 — 스크린 리더의
 *   가상 커서처럼 사용자가 고르지 않은 이유로도 blur가 난다. 바깥 누름은 사용자가 고른
 *   곳으로 포커스가 이미 갔으므로 포커스를 돌려주지 않는다.
 * - 입력 포커스는 편집을 열 때 한 번만 준다 — 인라인 `ref={el => el.focus()}`는 키 입력마다
 *   다시 불려 캐럿을 끌고 간다. 이미 포커스된 입력을 다시 포커스해도 캐럿은 그대로라
 *   `draft` 전체를 deps에 둬도 안전하다.
 * - 명시적으로 닫을 때(✕·Escape) 포커스를 연 ✎ 버튼으로 돌려준다 — 입력이 곧 사라져
 *   포커스가 `<body>`로 떨어지지 않게.
 */
export function useRenameMode(): UseRenameModeReturn {
    const [draft, setDraft] = useState<RenameDraft | null>(null);
    const rowRef = useRef<HTMLLIElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);

    useOnClickOutside(rowRef, () => setDraft(null), {
        enabled: draft !== null,
    });

    useEffect(() => {
        if (draft) inputRef.current?.focus();
    }, [draft]);

    return {
        draft,
        open: (id, title, trigger) => {
            triggerRef.current = trigger;
            setDraft({ id, title });
        },
        change: title => setDraft(prev => (prev ? { ...prev, title } : prev)),
        close: () => {
            setDraft(null);
            triggerRef.current?.focus();
        },
        rowRef,
        inputRef,
    };
}
