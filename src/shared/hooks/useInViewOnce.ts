'use client';

import { useEffect, useState } from 'react';

/**
 * 뷰포트 진입을 **1회만** 감지한다(진입 후 관찰 중단) — 목록 카드가 자기 종목의 데이터를
 * 화면에 보일 때만 fetch하도록 게이팅하는 지연 로드 트리거. `IntersectionObserver` 미지원
 * 환경(구형 브라우저)에서는 즉시 visible로 degrade한다. 원래 `PositionHoldingCard`의 private
 * 훅이었고, 내 종목 섹션(features)이 두 번째 소비자가 되어 shared로 올렸다.
 */
export function useInViewOnce<T extends Element>(): [
    (node: T | null) => void,
    boolean,
] {
    const [node, setNode] = useState<T | null>(null);
    // 미지원 방어를 lazy initializer로 결정해 effect 본문에서 setState를 동기 호출하지 않는다(EF-1).
    const [isVisible, setIsVisible] = useState(
        () => typeof IntersectionObserver === 'undefined'
    );

    useEffect(() => {
        if (node === null || isVisible) return;
        const observer = new IntersectionObserver(
            entries => {
                if (entries.some(entry => entry.isIntersecting)) {
                    setIsVisible(true);
                }
            },
            { rootMargin: '200px' }
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, [node, isVisible]);

    return [setNode, isVisible];
}
