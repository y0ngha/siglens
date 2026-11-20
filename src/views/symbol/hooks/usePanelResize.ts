'use client';

import type React from 'react';
import { useRef, useState, useSyncExternalStore } from 'react';
import { useDragListener } from './useDragListener';

/** AI 패널 최소 폭(px). */
export const PANEL_MIN_WIDTH = 240;
/** AI 패널 최대 폭이자 초기 폭(px). */
export const PANEL_MAX_WIDTH = 640;
/**
 * 패널이 한 행에서 차지할 수 있는 최대 비율. 차트 열이 행의 55% 이상을 지키도록 둔다 —
 * 태블릿(md~xl)에서 640px 패널이 820px 행을 먹어 차트가 ~180px 띠로 줄던 문제를 막는다.
 * ChartContent의 `md:w-[min(var(--panel-width),calc(45%-4px))]`와 같은 값이어야 한다.
 */
export const PANEL_MAX_ROW_SHARE = 0.45;
/** 드래그 핸들이 차지하는 폭(px, `w-1`). 패널 상한에서 빼 차트가 55%를 지키게 한다. */
export const PANEL_HANDLE_WIDTH = 4;
/** 이 뷰포트 폭(px, Tailwind `xl`) 이상에서는 행 비율 상한을 두지 않는다 — 데스크톱 배치 유지. */
export const PANEL_SHARE_CAP_BELOW_VIEWPORT = 1280;
/** 화살표 키 한 번의 폭 변화(px). */
const KEYBOARD_RESIZE_STEP = 10;

interface UsePanelResizeResult {
    panelWidth: number;
    /** 지금 허용되는 최대 폭(px) — 구분선의 `aria-valuemax`. 마운트 뒤 측정되고 창 크기에 따라 갱신된다. */
    panelMaxWidth: number;
    /** 화면에 실제로 그려지는 폭(px) = `min(panelWidth, panelMaxWidth)` — 구분선의 `aria-valuenow`. */
    displayWidth: number;
    isDragging: boolean;
    handleDragStart: (e: React.MouseEvent) => void;
    handleKeyDown: (e: React.KeyboardEvent) => void;
}

/**
 * 지금 허용되는 패널 최대 폭(px). 뷰포트가 `xl` 이상이거나 행 폭을 모르면(null·0) `PANEL_MAX_WIDTH`,
 * 그 아래(태블릿)에서는 행의 45%에서 핸들 폭을 뺀 값으로 줄인다(최소 `PANEL_MIN_WIDTH`).
 * 렌더 쪽 CSS `min()`과 같은 식이라 드래그·키보드 상태와 화면이 어긋나지 않는다.
 */
export function resolvePanelMaxWidth(
    rowWidth: number | null,
    viewportWidth: number
): number {
    // 0은 아직 레이아웃되지 않은(측정 불가) 행이다 — 모르는 것으로 취급한다.
    if (
        rowWidth === null ||
        rowWidth <= 0 ||
        viewportWidth >= PANEL_SHARE_CAP_BELOW_VIEWPORT
    ) {
        return PANEL_MAX_WIDTH;
    }
    const cap = Math.floor(rowWidth * PANEL_MAX_ROW_SHARE) - PANEL_HANDLE_WIDTH;
    return Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, cap));
}

function subscribeWindowResize(onChange: () => void): () => void {
    window.addEventListener('resize', onChange);
    return () => window.removeEventListener('resize', onChange);
}

/**
 * 패널 폭 상태. 드래그는 왼쪽으로 끌수록 넓어지고(패널이 오른쪽에 있다), ←/→ 키는 값(폭)을
 * 줄이고 늘린다 — 구분선의 `aria-valuenow`가 폭이다.
 */
export function usePanelResize(
    getRowWidth: () => number | null = () => null
): UsePanelResizeResult {
    const [panelWidth, setPanelWidth] = useState(PANEL_MAX_WIDTH);

    // 서버·하이드레이션 렌더는 `PANEL_MAX_WIDTH`(CSS가 이미 줄여 그리므로 레이아웃 이동 없음)이고,
    // 마운트 뒤 측정값으로 바뀐다. 창 크기가 바뀌면(행 폭도 따라 바뀐다) 다시 잰다.
    const panelMaxWidth = useSyncExternalStore(
        subscribeWindowResize,
        () => resolvePanelMaxWidth(getRowWidth(), window.innerWidth),
        () => PANEL_MAX_WIDTH
    );

    // 이벤트 시점에만 읽는다(렌더 중 측정 금지 — 하이드레이션 불일치·레이아웃 이동 방지).
    const currentMaxWidth = (): number =>
        resolvePanelMaxWidth(getRowWidth(), window.innerWidth);

    const panelWidthAtDragStartRef = useRef<number>(0);

    const { isDragging, handleDragStart: startDrag } = useDragListener({
        onResize: (deltaX: number): void => {
            const nextWidth = Math.min(
                currentMaxWidth(),
                Math.max(
                    PANEL_MIN_WIDTH,
                    panelWidthAtDragStartRef.current - deltaX
                )
            );
            // 최소·최대에 걸린 채 계속 끌면 같은 폭이 반복된다 — 그때는 렌더를 걸지 않는다.
            if (nextWidth !== panelWidth) setPanelWidth(nextWidth);
        },
    });

    const handleDragStart = (e: React.MouseEvent): void => {
        // 화면에 그려진 폭(상한으로 깎인 값)에서 출발해야 첫 드래그가 튀지 않는다.
        panelWidthAtDragStartRef.current = Math.min(
            panelWidth,
            currentMaxWidth()
        );
        startDrag(e);
    };

    const handleKeyDown = (e: React.KeyboardEvent): void => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

        e.preventDefault();

        if (e.key === 'ArrowLeft') {
            const max = currentMaxWidth();
            setPanelWidth(prev =>
                Math.max(
                    PANEL_MIN_WIDTH,
                    Math.min(prev, max) - KEYBOARD_RESIZE_STEP
                )
            );
        } else {
            const max = currentMaxWidth();
            setPanelWidth(prev =>
                Math.min(max, Math.min(prev, max) + KEYBOARD_RESIZE_STEP)
            );
        }
    };

    return {
        panelWidth,
        panelMaxWidth,
        displayWidth: Math.min(panelWidth, panelMaxWidth),
        isDragging,
        handleDragStart,
        handleKeyDown,
    };
}
