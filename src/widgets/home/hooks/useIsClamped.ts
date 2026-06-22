'use client';

import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

/**
 * 요소가 (line-clamp 등으로) 잘려 내용이 넘치는지 판정하는 순수 함수.
 * `scrollHeight`(전체 콘텐츠 높이) > `clientHeight`(보이는 높이)이면 클램프된 것.
 * 서브픽셀 반올림으로 1px 정도 차이가 날 수 있어 여유분 1px을 둔다.
 */
export function isElementClamped(el: HTMLElement | null): boolean {
    if (el == null) return false;
    return el.scrollHeight > el.clientHeight + 1;
}

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
 */
export function useIsClamped(enabled: boolean): UseIsClampedReturn {
    const ref = useRef<HTMLParagraphElement>(null);
    const [isClamped, setIsClamped] = useState(false);

    useLayoutEffect(() => {
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
