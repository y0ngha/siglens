'use client';

import { useEffect, type ReactNode } from 'react';
import { Drawer } from 'vaul';
import { cn } from '@/shared/lib/cn';
import { SNAP_POINTS_MUTABLE, type SnapPoint } from './constants/mobileSheet';
import { useMobileAnalysisSheet } from './hooks/useMobileAnalysisSheet';
import { useMobileSheetDrag } from './hooks/useMobileSheetDrag';

const POINTER_EVENTS_NONE = 'none';
const POINTER_EVENTS_AUTO = 'auto';

/**
 * vaul 1.1.2가 modal=false임에도 내부 Radix Dialog Root에 modal prop을 전달하지 않아
 * Radix DismissableLayer가 disableOutsidePointerEvents=true로 강제되며, body에
 * `pointer-events: none`이 적용된다. 결과적으로 시트 외부(상단 탭, 플로팅 버튼)가
 * 클릭 불가 상태가 되어 직접 복구한다. 자체 mutation으로 인한 재진입을 막기 위해
 * 복구 동안 observer를 일시 분리한다.
 */
function useRestoreBodyPointerEvents(): void {
    useEffect(() => {
        const observer = new MutationObserver(() => {
            if (document.body.style.pointerEvents === POINTER_EVENTS_NONE) {
                observer.disconnect();
                document.body.style.pointerEvents = POINTER_EVENTS_AUTO;
                observer.observe(document.body, {
                    attributes: true,
                    attributeFilter: ['style'],
                });
            }
        });
        if (document.body.style.pointerEvents === POINTER_EVENTS_NONE) {
            document.body.style.pointerEvents = POINTER_EVENTS_AUTO;
        }
        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['style'],
        });
        return () => observer.disconnect();
    }, []);
}

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
    const {
        isOpen,
        isFullSnap,
        contentRef,
        drawerContentRef,
        handleOpenChange,
    } = useMobileAnalysisSheet({ activeSnap, onActiveSnapChange });

    useMobileSheetDrag({
        scrollElRef: contentRef,
        drawerElRef: drawerContentRef,
        isFullSnap,
        onSnapChange: onActiveSnapChange,
    });

    useRestoreBodyPointerEvents();

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
                    ref={drawerContentRef}
                    // h-[97svh] 고정 — vaul의 snap translateY는 뷰포트 고정값(예: PEEK 654.5px)이므로
                    // max-h로 두면 콘텐츠가 줄어들 때 드로어가 함께 축소되어 PEEK 위치에서
                    // 완전히 뷰포트 밖으로 밀려나는 "사라짐" 버그가 발생한다.
                    className="bg-secondary-900 border-secondary-700 fixed inset-x-0 bottom-0 z-50 flex h-[97svh] flex-col overflow-hidden overscroll-contain rounded-t-2xl border-t pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.6)] md:hidden"
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
