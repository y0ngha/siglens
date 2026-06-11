'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * useState와 동일 시그니처의 localStorage 영속 상태. SSR-safe:
 * 서버/초기 렌더는 initial(hydration mismatch 방지), 마운트 후 저장값으로 복원, 변경 시 저장.
 */
export function usePersistentState<T>(
    key: string,
    initial: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [value, setValue] = useState<T>(initial);
    const hydrated = useRef(false);

    // 마운트 시 1회 복원 (있으면). 파싱 실패/없음은 initial 유지.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const raw = window.localStorage.getItem(key);
            if (raw !== null) setValue(JSON.parse(raw) as T);
        } catch {
            // 파싱 실패 — initial 유지
        }
        hydrated.current = true;
    }, [key]);

    // 값 변경 시 저장 (마운트 복원 이후부터).
    useEffect(() => {
        if (typeof window === 'undefined' || !hydrated.current) return;
        try {
            window.localStorage.setItem(key, JSON.stringify(value));
        } catch {
            // quota/직렬화 실패 — 무시
        }
    }, [key, value]);

    return [value, setValue];
}
