'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Drawer } from 'vaul';
import { cn } from '@/lib/cn';

export type SnapPoint = number | string | null;

export const SNAP_PEEK = 0.15; // 15% — 기본 접힘
export const SNAP_HALF = 0.55; // 55% — 분석 중 배너 노출
export const SNAP_FULL = 0.97; // 97% — 전체 열림

export const MOBILE_SNAP_POINTS = [SNAP_PEEK, SNAP_HALF, SNAP_FULL] as const;

// Vaul의 snapPoints prop은 readonly 배열을 허용하지 않아 mutable 사본을 사용한다
const SNAP_POINTS_MUTABLE = [...MOBILE_SNAP_POINTS] as number[];

interface MobileAnalysisSheetProps {
    activeSnap: SnapPoint;
    onActiveSnapChange: (snap: SnapPoint) => void;
    children: ReactNode;
}

export function MobileAnalysisSheet({
    activeSnap,
    onActiveSnapChange,
    children,
}: MobileAnalysisSheetProps) {
    // Vaul이 최소 스냅 아래 드래그 시 내부적으로 닫으려 할 수 있다. open 상태를
    // 직접 제어해 즉시 재오픈함으로써 시트가 화면에서 사라지지 않도록 한다.
    const [isOpen, setIsOpen] = useState(true);
    const handleOpenChange = useCallback((open: boolean) => {
        if (!open) setIsOpen(true);
    }, []);

    const isFullSnap = activeSnap === SNAP_FULL;

    // FULL 스냅 + scrollTop === 0에서 아래로 스와이프 시 시트를 축소하는 제스처.
    // vaul의 shouldDrag는 isDraggingInDirection 체크에서 아래 방향 드래그를
    // 무조건 차단하므로, 별도 터치 핸들러로 스냅 포인트를 직접 전환한다.
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = contentRef.current;
        if (!el || !isFullSnap) return;

        let startY = 0;
        let startedAtTop = false;

        function onTouchStart(e: TouchEvent): void {
            startY = e.touches[0].clientY;
            startedAtTop = el!.scrollTop <= 0;
        }

        function onTouchEnd(e: TouchEvent): void {
            if (!startedAtTop) return;
            const deltaY = e.changedTouches[0].clientY - startY;
            if (deltaY <= 0) return;

            const vh = window.innerHeight;
            if (deltaY > vh * 0.5) {
                onActiveSnapChange(SNAP_PEEK);
            } else if (deltaY > vh * 0.15) {
                onActiveSnapChange(SNAP_HALF);
            }
        }

        el.addEventListener('touchstart', onTouchStart, { passive: true });
        el.addEventListener('touchend', onTouchEnd, { passive: true });
        return () => {
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchend', onTouchEnd);
        };
    }, [isFullSnap, onActiveSnapChange]);

    return (
        <Drawer.Root
            open={isOpen}
            onOpenChange={handleOpenChange}
            modal={false}
            dismissible={false}
            snapPoints={SNAP_POINTS_MUTABLE}
            activeSnapPoint={activeSnap}
            setActiveSnapPoint={onActiveSnapChange}
            handleOnly={isFullSnap}
            snapToSequentialPoint
        >
            <Drawer.Portal>
                <Drawer.Content
                    className="bg-secondary-900 border-secondary-700 fixed inset-x-0 bottom-0 z-40 flex max-h-[97svh] flex-col overflow-hidden overscroll-contain rounded-t-2xl border-t pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.6)] md:hidden"
                    aria-live="polite"
                >
                    <Drawer.Handle
                        className="shrink-0"
                        aria-label="AI 분석 패널 크기 조절"
                    />
                    <Drawer.Title className="sr-only">
                        AI 분석 패널
                    </Drawer.Title>
                    <Drawer.Description className="sr-only">
                        위로 드래그하여 분석 내용을 확인하세요
                    </Drawer.Description>
                    <div
                        ref={contentRef}
                        className={cn(
                            'min-h-0 flex-1 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]',
                            isFullSnap ? 'overflow-y-auto' : 'overflow-hidden'
                        )}
                    >
                        {children}
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}
