'use client';

import {
    useCallback,
    useEffect,
    useEffectEvent,
    useRef,
    useState,
} from 'react';
import type React from 'react';

interface UseDragListenerOptions {
    onResize: (deltaX: number) => void;
}

interface UseDragListenerResult {
    isDragging: boolean;
    handleDragStart: (e: React.MouseEvent) => void;
}

export function useDragListener({
    onResize,
}: UseDragListenerOptions): UseDragListenerResult {
    const [isDragging, setIsDragging] = useState(false);
    const dragStartXRef = useRef<number>(0);

    const handleDragStart = useCallback((e: React.MouseEvent): void => {
        if (e.button !== 0) return;
        e.preventDefault();
        dragStartXRef.current = e.clientX;
        setIsDragging(true);
    }, []);

    const handleMouseMove = useEffectEvent((e: MouseEvent) => {
        onResize(dragStartXRef.current - e.clientX);
    });

    const handleMouseUp = useEffectEvent(() => {
        setIsDragging(false);
    });

    useEffect(() => {
        if (!isDragging) return;

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    return { isDragging, handleDragStart };
}
