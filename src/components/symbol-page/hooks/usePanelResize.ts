'use client';

import type React from 'react';
import { useCallback, useRef, useState } from 'react';
import { useDragListener } from '@/components/symbol-page/hooks/useDragListener';

export const PANEL_MIN_WIDTH = 240;
export const PANEL_MAX_WIDTH = 640;
const PANEL_DEFAULT_WIDTH = 320;
const KEYBOARD_RESIZE_STEP = 10;

interface UsePanelResizeResult {
    panelWidth: number;
    isDragging: boolean;
    handleDragStart: (e: React.MouseEvent) => void;
    handleKeyDown: (e: React.KeyboardEvent) => void;
}

export function usePanelResize(): UsePanelResizeResult {
    const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT_WIDTH);
    const panelWidthAtDragStartRef = useRef<number>(PANEL_DEFAULT_WIDTH);

    const { isDragging, handleDragStart: startDrag } = useDragListener({
        onResize: (deltaX: number): void => {
            const nextWidth = Math.min(
                PANEL_MAX_WIDTH,
                Math.max(
                    PANEL_MIN_WIDTH,
                    panelWidthAtDragStartRef.current + deltaX
                )
            );
            setPanelWidth(nextWidth);
        },
    });

    const handleDragStart = useCallback(
        (e: React.MouseEvent): void => {
            panelWidthAtDragStartRef.current = panelWidth;
            startDrag(e);
        },
        [panelWidth, startDrag]
    );

    const handleKeyDown = useCallback((e: React.KeyboardEvent): void => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

        e.preventDefault();

        if (e.key === 'ArrowLeft') {
            setPanelWidth(prev =>
                Math.max(PANEL_MIN_WIDTH, prev - KEYBOARD_RESIZE_STEP)
            );
        } else if (e.key === 'ArrowRight') {
            setPanelWidth(prev =>
                Math.min(PANEL_MAX_WIDTH, prev + KEYBOARD_RESIZE_STEP)
            );
        }
    }, []);

    return { panelWidth, isDragging, handleDragStart, handleKeyDown };
}
