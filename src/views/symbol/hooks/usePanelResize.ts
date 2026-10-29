'use client';

/**
 * 데스크톱 AI 패널 폭 조절(마우스 드래그·키보드).
 */
import type React from 'react';
import { useRef, useState } from 'react';
import { useDragListener } from './useDragListener';

/** AI 패널 최소 폭(px). */
export const PANEL_MIN_WIDTH = 240;
/** AI 패널 최대 폭이자 초기 폭(px). */
export const PANEL_MAX_WIDTH = 640;
/** 화살표 키 한 번의 폭 변화(px). */
const KEYBOARD_RESIZE_STEP = 10;

interface UsePanelResizeResult {
    panelWidth: number;
    isDragging: boolean;
    handleDragStart: (e: React.MouseEvent) => void;
    handleKeyDown: (e: React.KeyboardEvent) => void;
}

/**
 * 패널 폭 상태. 드래그는 왼쪽으로 끌수록 넓어지고(패널이 오른쪽에 있다), ←/→ 키는 값(폭)을
 * 줄이고 늘린다 — 구분선의 `aria-valuenow`가 폭이다.
 */
export function usePanelResize(): UsePanelResizeResult {
    const [panelWidth, setPanelWidth] = useState(PANEL_MAX_WIDTH);

    const panelWidthAtDragStartRef = useRef<number>(0);

    const { isDragging, handleDragStart: startDrag } = useDragListener({
        onResize: (deltaX: number): void => {
            const nextWidth = Math.min(
                PANEL_MAX_WIDTH,
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
        panelWidthAtDragStartRef.current = panelWidth;
        startDrag(e);
    };

    const handleKeyDown = (e: React.KeyboardEvent): void => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

        e.preventDefault();

        if (e.key === 'ArrowLeft') {
            setPanelWidth(prev =>
                Math.max(PANEL_MIN_WIDTH, prev - KEYBOARD_RESIZE_STEP)
            );
        } else {
            setPanelWidth(prev =>
                Math.min(PANEL_MAX_WIDTH, prev + KEYBOARD_RESIZE_STEP)
            );
        }
    };

    return { panelWidth, isDragging, handleDragStart, handleKeyDown };
}
