'use client';

import type React from 'react';
import { useRef, useState } from 'react';
import { useDragListener } from './useDragListener';

export const PANEL_MIN_WIDTH = 240;
export const PANEL_MAX_WIDTH = 640;
const KEYBOARD_RESIZE_STEP = 10;

interface UsePanelResizeResult {
    panelWidth: number;
    isDragging: boolean;
    handleDragStart: (e: React.MouseEvent) => void;
    handleKeyDown: (e: React.KeyboardEvent) => void;
}

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
