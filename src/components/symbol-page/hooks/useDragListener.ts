'use client';

import { useEffect } from 'react';

interface UseDragListenerOptions {
    isDragging: boolean;
    onMouseMove: (e: MouseEvent) => void;
    onMouseUp: () => void;
}

export function useDragListener({
    isDragging,
    onMouseMove,
    onMouseUp,
}: UseDragListenerOptions): void {
    useEffect(() => {
        if (!isDragging) return;

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        return () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
    }, [isDragging, onMouseMove, onMouseUp]);
}
