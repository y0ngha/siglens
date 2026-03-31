'use client';

import { useEffect, useEffectEvent } from 'react';

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
    const handleMouseMove = useEffectEvent((e: MouseEvent) => {
        onMouseMove(e);
    });

    const handleMouseUp = useEffectEvent(() => {
        onMouseUp();
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
}
