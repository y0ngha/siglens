'use client';

/**
 * 차트 헤더 메뉴 트리거 아래에 뜨는 팝오버 패널 컨테이너.
 */

import { type ReactNode, type RefObject, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/shared/lib/cn';
import { computePopoverPlacement } from '../utils/popoverPlacement';
import { CHART_POPOVER_PANEL } from './chartPopoverStyles';

interface ChartPopoverPanelProps {
    readonly triggerRef: RefObject<HTMLElement | null>;
    /** 패널 ref — 호출부의 `useFocusTrap`·`usePopoverToggle`이 같은 ref를 쓴다. */
    readonly panelRef: RefObject<HTMLDivElement | null>;
    readonly id: string;
    /** 패널 그룹의 접근 가능한 이름. */
    readonly label: string;
    /** 원하는 폭(px). 뷰포트가 좁으면 줄어든다. */
    readonly width: number;
    readonly className?: string;
    readonly children: ReactNode;
}

/**
 * 차트 헤더 띠 메뉴의 패널. **`document.body`로 포털하고 뷰포트 좌표(`fixed`)로 놓는다** — 차트 열이
 * `overflow-hidden`이라 앵커 안의 `absolute` 패널은 좁은 열에서 왼쪽이 잘리고, 모바일에서는 아래가 잘리거나
 * AI 시트 밑에 깔렸다. 좌표 계산은 `computePopoverPlacement`(뷰포트 안으로 clamp)가 하고, 리사이즈·스크롤마다
 * 다시 놓는다. 좌표는 state가 아니라 DOM 스타일로 직접 쓴다 — 스크롤 중 리렌더를 만들지 않고, 레이아웃
 * 이펙트라 첫 페인트와 `useFocusTrap`의 첫 포커스 전에 이미 자리가 잡힌다.
 *
 * 열려 있을 때만 마운트한다(호출부가 `isOpen &&`로 감싼다) — 그래서 SSR에서는 `document`를 만지지 않고,
 * 그 불변식이 깨져도 `typeof document` 가드가 `null`을 돌려준다.
 */
export function ChartPopoverPanel({
    triggerRef,
    panelRef,
    id,
    label,
    width,
    className,
    children,
}: ChartPopoverPanelProps) {
    useLayoutEffect(() => {
        const place = (): void => {
            const panel = panelRef.current;
            const trigger = triggerRef.current;
            if (panel === null || trigger === null) return;
            const rect = trigger.getBoundingClientRect();
            const placement = computePopoverPlacement({
                trigger: rect,
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight,
                },
                width,
            });
            panel.style.top = `${placement.top}px`;
            panel.style.left = `${placement.left}px`;
            panel.style.width = `${placement.width}px`;
            // 아래 안전 영역(홈 인디케이터)만큼 더 비운다 — `env()`는 CSS 안에서만 풀려 calc로 넘긴다.
            panel.style.maxHeight = `calc(${placement.maxHeight}px - env(safe-area-inset-bottom, 0px))`;
        };
        place();
        window.addEventListener('resize', place);
        // capture: 차트 열·페이지 어느 스크롤 컨테이너가 움직여도 트리거를 따라간다.
        window.addEventListener('scroll', place, true);
        return () => {
            window.removeEventListener('resize', place);
            window.removeEventListener('scroll', place, true);
        };
    }, [panelRef, triggerRef, width]);

    // SSR 가드 — 호출부가 `isOpen &&`로 열렸을 때만 마운트하지만, 그 불변식을 이 파일에서도 강제한다.
    if (typeof document === 'undefined') return null;

    return createPortal(
        <div
            ref={panelRef}
            // globals.css가 이 표식이 있는 동안 PWA 설치 배너(z-65)·Ask-AI FAB을 숨긴다 — 배너가 패널 아래를 가린다.
            data-chart-popover
            id={id}
            role="group"
            aria-label={label}
            tabIndex={-1}
            className={cn(CHART_POPOVER_PANEL, className)}
        >
            {children}
        </div>,
        document.body
    );
}
