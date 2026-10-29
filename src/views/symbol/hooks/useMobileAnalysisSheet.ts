'use client';

import { SNAP_FULL, SNAP_PEEK, type SnapPoint } from '../constants/mobileSheet';
import { type RefObject, useEffect, useRef, useState } from 'react';

interface UseMobileAnalysisSheetOptions {
    activeSnap: SnapPoint;
    onActiveSnapChange: (snap: SnapPoint) => void;
}

interface UseMobileAnalysisSheetReturn {
    isOpen: boolean;
    isFullSnap: boolean;
    contentRef: RefObject<HTMLDivElement | null>;
    drawerContentRef: RefObject<HTMLDivElement | null>;
    handleOpenChange: (open: boolean) => void;
}

/**
 * Delay (ms) before flipping the mobile analysis sheet to `open=true` after
 * mount. Gives Vaul's hydration plus a paint cycle time to complete before the
 * sheet opens, which prevents the aria-hidden flicker and Header attribute
 * mismatch described in the JSDoc of `useMobileAnalysisSheet`.
 * 66ms = one frame at 60fps (~16ms) plus the 50ms safety buffer the previous
 * `requestAnimationFrame` + 50ms scheduling added up to.
 *
 * Revisit this value if Vaul or the underlying Radix Dialog change their
 * hydration timing — too small reintroduces the flicker, too large delays
 * the perceived sheet appearance on mobile.
 */
export const MOBILE_ANALYSIS_SHEET_OPEN_DELAY_MS = 66;

/**
 * 시트 열림을 하이드레이션 뒤로 미루고, vaul이 닫으려 하면 PEEK로 되돌린다.
 *
 * MobileAnalysisSheet 내부의 state/refs/핸들러를 한 곳에 모은다.
 * Hydration 직후 열린 vaul/Radix Dialog가 document 형제 요소에 aria-hidden을 주입하면
 * React의 초기 hydration 비교와 겹쳐 Header 속성 mismatch가 발생할 수 있다.
 * 한 프레임과 짧은 버퍼가 지난 뒤 open=true로 전환해 DOM mutation 시점을 hydration 이후로 민다.
 * 타이머만 쓰고 `requestAnimationFrame`에 걸지 않는다 — 프레임을 돌리지 않는 환경(일부 모바일
 * 브라우저·인앱 웹뷰)에서는 콜백이 화면을 한 번 건드릴 때까지 오지 않아, 시트가 그때까지
 * 뜨지 않았다(2026-10-22 실기기 제보, rAF를 멈춘 브라우저로 재현).
 * Vaul이 최소 스냅 아래 드래그 시 내부적으로 닫으려 할 수 있으므로 open을 직접 제어해
 * 즉시 재오픈하고 activeSnap도 SNAP_PEEK로 초기화한다 — 시트/핸들이 사라지지 않도록 보호.
 */
export function useMobileAnalysisSheet({
    activeSnap,
    onActiveSnapChange,
}: UseMobileAnalysisSheetOptions): UseMobileAnalysisSheetReturn {
    const [isOpen, setIsOpen] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);
    const drawerContentRef = useRef<HTMLDivElement>(null);
    const isFullSnap = activeSnap === SNAP_FULL;

    useEffect(() => {
        const timeoutId = window.setTimeout(
            () => setIsOpen(true),
            MOBILE_ANALYSIS_SHEET_OPEN_DELAY_MS
        );
        return () => window.clearTimeout(timeoutId);
    }, []);

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            onActiveSnapChange(SNAP_PEEK);
            setIsOpen(true);
        }
    };

    return {
        isOpen,
        isFullSnap,
        contentRef,
        drawerContentRef,
        handleOpenChange,
    };
}
