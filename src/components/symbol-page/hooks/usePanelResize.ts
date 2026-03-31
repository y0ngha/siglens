'use client';

import type React from 'react';
import { useCallback, useRef, useState } from 'react';
import { useDragListener } from '@/components/symbol-page/hooks/useDragListener';

export const PANEL_MIN_WIDTH = 240;
export const PANEL_MAX_WIDTH = 640;
const PANEL_DEFAULT_WIDTH = 320;

interface UsePanelResizeResult {
    panelWidth: number;
    isDragging: boolean;
    handleDragStart: (e: React.MouseEvent) => void;
}

export function usePanelResize(): UsePanelResizeResult {
    const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT_WIDTH);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartXRef = useRef<number>(0);
    const dragStartWidthRef = useRef<number>(PANEL_DEFAULT_WIDTH);

    const handleDragStart = useCallback(
        (e: React.MouseEvent): void => {
            if (e.button !== 0) return;
            e.preventDefault();
            dragStartXRef.current = e.clientX;
            dragStartWidthRef.current = panelWidth;
            setIsDragging(true);
        },
        [panelWidth]
    );

    const handleMouseMove = (e: MouseEvent): void => {
        const delta = dragStartXRef.current - e.clientX;
        const nextWidth = Math.min(
            PANEL_MAX_WIDTH,
            Math.max(PANEL_MIN_WIDTH, dragStartWidthRef.current + delta)
        );
        setPanelWidth(nextWidth);
    };

    const handleMouseUp = (): void => {
        setIsDragging(false);
    };

    useDragListener({
        isDragging,
        onMouseMove: handleMouseMove,
        onMouseUp: handleMouseUp,
    });

    return { panelWidth, isDragging, handleDragStart };
}
