'use client';

import { type RefObject, useEffect, useRef } from 'react';

// window.adsbygoogle: Google AdSense가 로드 후 채우는 전역 배열.
declare global {
    interface Window {
        adsbygoogle?: object[];
    }
}

// 컨테이너 너비가 실제로 확보된 뒤에만 adsbygoogle.push를 1회 호출한다.
// ResizeObserver로 0px 초기 상태에서의 빈 광고 삽입을 방지한다.
export function useAdSensePush(
    containerRef: RefObject<HTMLDivElement | null>,
    enabled: boolean
): void {
    const isPushedRef = useRef(false);

    useEffect(() => {
        if (!enabled || isPushedRef.current) return;
        const container = containerRef.current;
        if (!container) return;

        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                if (entry.contentRect.width > 0) {
                    try {
                        (window.adsbygoogle = window.adsbygoogle ?? []).push(
                            {}
                        );
                        isPushedRef.current = true;
                        observer.disconnect();
                    } catch (e) {
                        console.error('AdSense push error:', e);
                    }
                }
            }
        });

        observer.observe(container);

        return () => observer.disconnect();
    }, [enabled, containerRef]);
}
