'use client';

import { useEffect, useEffectEvent, type RefObject } from 'react';
import {
    DRAG_RESISTANCE,
    DRAG_THRESHOLD_PX,
    DRAG_TO_HALF_THRESHOLD,
    DRAG_TO_PEEK_THRESHOLD,
    SNAP_BACK_DURATION,
    SNAP_HALF,
    SNAP_PEEK,
    VAUL_EASING,
    type SnapPoint,
} from '@/components/symbol-page/constants/mobileSheet';
import { captureTransformY } from '@/components/symbol-page/utils/mobileSheetDom';

interface UseMobileSheetDragOptions {
    scrollElRef: RefObject<HTMLDivElement | null>;
    drawerElRef: RefObject<HTMLDivElement | null>;
    isFullSnap: boolean;
    onSnapChange: (snap: SnapPoint) => void;
}

// FULL 스냅 + scrollTop === 0에서 아래로 스와이프 시 시트를 축소하는 제스처.
// vaul의 shouldDrag는 아래 방향 드래그를 차단하므로, 별도 터치 핸들러로 스냅 전환을 처리한다.
// touchmove에서 Drawer.Content의 transform을 직접 조작해 손가락을 따라오는 실시간 피드백을 준다.
export function useMobileSheetDrag({
    scrollElRef,
    drawerElRef,
    isFullSnap,
    onSnapChange,
}: UseMobileSheetDragOptions): void {
    // 부모가 메모이제이션 없이 콜백을 전달해도 effect가 재마운트되지 않도록 안정 참조를 보장한다.
    const snapToPoint = useEffectEvent((snap: SnapPoint) => {
        onSnapChange(snap);
    });

    useEffect(() => {
        if (!scrollElRef.current || !drawerElRef.current || !isFullSnap) return;

        const scrollEl = scrollElRef.current;
        const drawerEl = drawerElRef.current;

        let startY = 0;
        let startedAtTop = false;
        let isDragging = false;
        let initialTransformY = 0;

        // 드래그를 중단하고 vaul의 FULL 스냅 위치로 부드럽게 복귀한다.
        // activeSnap이 이미 SNAP_FULL이면 React가 리렌더를 건너뛰므로 CSS transition으로 직접 처리한다.
        function snapBack(): void {
            drawerEl.style.transition = `transform ${SNAP_BACK_DURATION} ${VAUL_EASING}`;
            // SNAP_FULL 위치는 항상 translateY(0)이므로 initialTransformY에 의존하지 않는다.
            drawerEl.style.transform = 'translateY(0px)';
            drawerEl.addEventListener(
                'transitionend',
                () => {
                    if (!isDragging) drawerEl.style.transition = '';
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
                // 실제 DOM 위치를 동기화한다. 이를 생략하면 반복 스와이프 시 위치가 drift된다.
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

            // passive: false로 등록되어 있어 호출 가능하다. 기본 스크롤을 차단한다.
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

            if (deltaY > vh * DRAG_TO_PEEK_THRESHOLD) {
                snapToPoint(SNAP_PEEK);
            } else if (deltaY > vh * DRAG_TO_HALF_THRESHOLD) {
                snapToPoint(SNAP_HALF);
            } else {
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
        // passive: false — isDragging 진입 후 e.preventDefault() 호출을 허용한다.
        scrollEl.addEventListener('touchmove', onTouchMove, { passive: false });
        scrollEl.addEventListener('touchend', onTouchEnd, { passive: true });
        scrollEl.addEventListener('touchcancel', onTouchCancel, {
            passive: true,
        });

        return () => {
            scrollEl.removeEventListener('touchstart', onTouchStart);
            scrollEl.removeEventListener('touchmove', onTouchMove);
            scrollEl.removeEventListener('touchend', onTouchEnd);
            scrollEl.removeEventListener('touchcancel', onTouchCancel);
            drawerEl.style.transform = '';
            drawerEl.style.transition = '';
        };
    }, [isFullSnap, scrollElRef, drawerElRef]);
}
