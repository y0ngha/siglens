'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { isElementClamped } from '@/shared/lib/clamp';

interface UseIsClampedReturn {
    ref: RefObject<HTMLParagraphElement | null>;
    isClamped: boolean;
}

/**
 * 설명 단락의 클램프 발생 여부를 측정한다.
 *
 * 측정은 **접힌(클램프된) 상태에서만** 유효하다 — 펼쳐지면 clamp가 풀려
 * `scrollHeight == clientHeight`가 되어 판정이 뒤집히기 때문이다. 따라서
 * `enabled`(= 접힘 상태)일 때만 측정하고, 펼침 중에는 직전 값을 유지한다.
 * 카드 폭 변화(반응형 브레이크포인트·창 리사이즈)는 ResizeObserver로 재측정한다.
 *
 * `useEffect`를 사용한다 — `line-clamp-2`가 CSS로 레이아웃을 이미 제한하므로
 * 첫 페인트 이후 측정해도 CLS 없이 정확한 값을 얻을 수 있다.
 */
export function useIsClamped(enabled: boolean): UseIsClampedReturn {
    const [isClamped, setIsClamped] = useState(false);
    const ref = useRef<HTMLParagraphElement>(null);

    useEffect(() => {
        if (!enabled) return;
        const el = ref.current;
        if (el == null) return;

        const measure = (): void => {
            setIsClamped(isElementClamped(el));
        };
        measure();

        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, [enabled]);

    return { ref, isClamped };
}
