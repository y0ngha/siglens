'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * 담기 성공으로 CTA가 사라질 때 포커스를 돌려줄 요소의 ref. 버튼이 사라지면 포커스가 body로
 * 떨어져 Tab이 모달 밖으로 새므로, `added`가 false → true로 **바뀌는 순간에만** 이 요소로
 * 포커스를 옮긴다. 열릴 때 이미 담겨 있으면(마운트 시점 값) 건드리지 않는다 — 모달의
 * 패널 포커스를 빼앗지 않기 위해서다.
 */
export function useFocusWhenAdded<T extends HTMLElement>(
    added: boolean
): RefObject<T | null> {
    const targetRef = useRef<T>(null);
    const wasAddedRef = useRef(added);

    useEffect(() => {
        if (added && !wasAddedRef.current) targetRef.current?.focus();
        wasAddedRef.current = added;
    }, [added]);

    return targetRef;
}
