'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';

/**
 * useState와 동일 시그니처의 localStorage 영속 상태. SSR-safe:
 * 서버/초기 렌더는 initial을 사용해 hydration mismatch를 피하고, 마운트 후 저장값으로 복원하며,
 * 이후 값 변경 시 저장한다. 복원 로직은 useEffectEvent로 감싸 effect 의존성에서 빠지므로
 * set-state-in-effect 린트를 suppress 없이 만족한다 (MISTAKES §10 — React 19 canonical fix).
 */
export function usePersistentState<T>(
    key: string,
    initial: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [value, setValue] = useState<T>(initial);
    const hydrated = useRef(false);

    const restoreFromStorage = useEffectEvent(() => {
        if (typeof window === 'undefined') return;
        try {
            const raw = window.localStorage.getItem(key);
            // JSON.parse는 any를 반환한다. 이 훅이 같은 key의 쓰기(JSON.stringify(value: T))를 단독
            // 소유하므로 역직렬화 결과는 항상 T와 일치한다 — 런타임 보장이 있는 안전한 캐스트.
            if (raw !== null) setValue(JSON.parse(raw) as T);
        } catch {
            // 파싱 실패/접근 불가 시 initial 유지 (의도된 graceful fallback — 빈 catch 아님)
        }
        hydrated.current = true;
    });

    useEffect(() => {
        restoreFromStorage();
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined' || !hydrated.current) return;
        try {
            window.localStorage.setItem(key, JSON.stringify(value));
        } catch {
            // quota 초과/직렬화 실패는 무시 (영속 실패가 앱 동작을 막지 않도록)
        }
    }, [key, value]);

    return [value, setValue];
}
