'use client';

import { useEffect } from 'react';

// Tailwind 클래스는 React 트리 내부 요소에만 적용 가능하므로
// html/body 전역 DOM에는 style.setProperty로 직접 주입해야 한다.
// AdSense가 overflow를 덮어쓰지 못하도록 !important를 사용한다.
// mount 시 잠금, unmount(라우트 이탈) 시 복원해 메인 페이지 스크롤에 영향을 주지 않는다.
export function SymbolLayoutClient({
    children,
}: {
    children: React.ReactNode;
}) {
    useEffect(() => {
        // mount-only: document.documentElement, document.body는 안정적인 전역 참조
        const html = document.documentElement;
        const body = document.body;

        html.style.setProperty('height', '100%', 'important');
        html.style.setProperty('overflow', 'hidden', 'important');
        body.style.setProperty('height', '100%', 'important');
        body.style.setProperty('overflow', 'hidden', 'important');

        return () => {
            html.style.removeProperty('height');
            html.style.removeProperty('overflow');
            body.style.removeProperty('height');
            body.style.removeProperty('overflow');
        };
    }, []);

    return <>{children}</>;
}
