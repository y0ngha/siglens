'use client';

import { useCallback, useRef, useState, type RefObject } from 'react';
import {
    SNAP_FULL,
    SNAP_PEEK,
    type SnapPoint,
} from '@/components/symbol-page/constants/mobileSheet';

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

// MobileAnalysisSheet 내부의 state/refs/핸들러를 한 곳에 모은다.
// Vaul이 최소 스냅 아래 드래그 시 내부적으로 닫으려 할 수 있으므로 open을 직접 제어해
// 즉시 재오픈하고 activeSnap도 SNAP_PEEK로 초기화한다 — 시트/핸들이 사라지지 않도록 보호.
export function useMobileAnalysisSheet({
    activeSnap,
    onActiveSnapChange,
}: UseMobileAnalysisSheetOptions): UseMobileAnalysisSheetReturn {
    const [isOpen, setIsOpen] = useState(true);
    const contentRef = useRef<HTMLDivElement>(null);
    const drawerContentRef = useRef<HTMLDivElement>(null);
    const isFullSnap = activeSnap === SNAP_FULL;

    const handleOpenChange = useCallback(
        (open: boolean) => {
            if (!open) {
                onActiveSnapChange(SNAP_PEEK);
                setIsOpen(true);
            }
        },
        [onActiveSnapChange]
    );

    return {
        isOpen,
        isFullSnap,
        contentRef,
        drawerContentRef,
        handleOpenChange,
    };
}
