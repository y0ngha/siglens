'use client';

import {
    useState,
    useCallback,
    useRef,
    useEffect,
    useEffectEvent,
} from 'react';
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

// vaul 드로어 애니메이션과 동일한 easing 곡선
const VAUL_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';

// vaul이 현재 적용한 translateY 값(px)을 computed style에서 읽는다.
function captureTransformY(el: HTMLDivElement): number {
    return new DOMMatrix(window.getComputedStyle(el).transform).m42;
}
// 드래그 시 손가락 속도 대비 시트 이동 비율 (러버밴드 효과)
const DRAG_RESISTANCE = 0.6;
// 드래그로 간주하기 위한 최소 이동량(px)
const DRAG_THRESHOLD_PX = 8;

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
    // 직접 제어해 즉시 재오픈하고, activeSnap도 SNAP_PEEK로 초기화해
    // 시트와 핸들이 화면에서 사라지지 않도록 한다.
    const [isOpen, setIsOpen] = useState(true);

    // FULL 스냅 + scrollTop === 0에서 아래로 스와이프 시 시트를 축소하는 제스처.
    // vaul의 shouldDrag는 isDraggingInDirection 체크에서 아래 방향 드래그를
    // 무조건 차단하므로, 별도 터치 핸들러로 스냅 포인트를 직접 전환한다.
    // touchmove에서 Drawer.Content의 transform을 직접 조작하여
    // 손가락을 따라오는 실시간 피드백을 제공한다.
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

    // useEffectEvent로 래핑하여 부모가 메모이제이션 없이 콜백을 전달해도
    // effect가 재마운트되지 않도록 안정적인 참조를 보장한다.
    const snapToPoint = useEffectEvent((snap: SnapPoint) => {
        onActiveSnapChange(snap);
    });

    useEffect(() => {
        if (!contentRef.current || !drawerContentRef.current || !isFullSnap)
            return;

        const scrollEl = contentRef.current;
        const drawerEl = drawerContentRef.current;

        let startY = 0;
        let startedAtTop = false;
        let isDragging = false;
        let initialTransformY = 0;

        // 드래그를 중단하고 vaul의 FULL 스냅 위치로 부드럽게 복귀한다.
        // activeSnap이 이미 SNAP_FULL이면 React가 리렌더를 건너뛰므로
        // CSS transition을 직접 적용해 애니메이션을 처리한다.
        function snapBack(): void {
            drawerEl.style.transition = `transform 0.5s ${VAUL_EASING}`;
            // SNAP_FULL 위치는 항상 translateY(0)이므로 initialTransformY에 의존하지 않는다.
            drawerEl.style.transform = 'translateY(0px)';
            drawerEl.addEventListener(
                'transitionend',
                () => {
                    // 새로운 드래그가 시작된 경우 transition 초기화를 건너뛴다
                    if (!isDragging) {
                        drawerEl.style.transition = '';
                    }
                },
                { once: true }
            );
        }

        function onTouchStart(e: TouchEvent): void {
            startY = e.touches[0].clientY;
            startedAtTop = scrollEl.scrollTop <= 0;
            isDragging = false;
            if (startedAtTop) {
                // 진행 중인 snapBack() 애니메이션을 즉시 중단해 initialTransformY와
                // 실제 DOM 위치를 동기화한다. 이를 생략하면 애니메이션 중간값이
                // 기준점으로 캡처되어 반복 스와이프 시 위치가 누적 drift된다.
                initialTransformY = captureTransformY(drawerEl);
                drawerEl.style.transition = 'none';
                drawerEl.style.transform = `translateY(${initialTransformY}px)`;
            }
        }

        function onTouchMove(e: TouchEvent): void {
            if (!startedAtTop) return;
            const deltaY = e.touches[0].clientY - startY;

            if (!isDragging) {
                if (deltaY <= 0) return;
                if (deltaY > DRAG_THRESHOLD_PX) {
                    isDragging = true;
                } else {
                    return;
                }
            }

            // 드래그 진입 후 모든 방향의 터치 이동을 제어하고 기본 스크롤을 차단한다.
            // passive: false로 등록되어 있어 호출 가능하다.
            e.preventDefault();

            drawerEl.style.transition = 'none';
            // 위로 드래그해도 시트가 시작 위치 위로 올라가지 않도록 0으로 제한한다.
            drawerEl.style.transform = `translateY(${initialTransformY + Math.max(0, deltaY) * DRAG_RESISTANCE}px)`;
        }

        function onTouchEnd(e: TouchEvent): void {
            if (!startedAtTop || !isDragging) return;
            isDragging = false;

            const deltaY = e.changedTouches[0].clientY - startY;
            const vh = window.innerHeight;

            if (deltaY > vh * 0.45) {
                // 충분히 드래그: PEEK로 스냅
                // snapToPoint → React 리렌더 → vaul이 현재 transform 위치에서
                // 새 스냅 위치까지 CSS transition으로 애니메이션
                snapToPoint(SNAP_PEEK);
            } else if (deltaY > vh * 0.12) {
                // 중간 드래그: HALF로 스냅
                snapToPoint(SNAP_HALF);
            } else {
                // 드래그 부족: FULL로 복귀
                snapBack();
            }
        }

        function onTouchCancel(): void {
            if (isDragging) {
                isDragging = false;
                snapBack();
            }
        }

        scrollEl.addEventListener('touchstart', onTouchStart, {
            passive: true,
        });
        // passive: false — isDragging 진입 후 e.preventDefault()를 호출하기 위해 필요
        scrollEl.addEventListener('touchmove', onTouchMove, {
            passive: false,
        });
        scrollEl.addEventListener('touchend', onTouchEnd, { passive: true });
        scrollEl.addEventListener('touchcancel', onTouchCancel, {
            passive: true,
        });

        return () => {
            scrollEl.removeEventListener('touchstart', onTouchStart);
            scrollEl.removeEventListener('touchmove', onTouchMove);
            scrollEl.removeEventListener('touchend', onTouchEnd);
            scrollEl.removeEventListener('touchcancel', onTouchCancel);
            // 직접 조작한 스타일을 초기화하여 vaul의 내부 스타일과 충돌을 방지한다.
            drawerEl.style.transform = '';
            drawerEl.style.transition = '';
        };
    }, [isFullSnap]);

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
                    className="bg-secondary-900 border-secondary-700 fixed inset-x-0 bottom-0 z-40 flex h-[97svh] flex-col overflow-hidden overscroll-contain rounded-t-2xl border-t pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.6)] md:hidden"
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
