'use client';

import type React from 'react';
import { useEffect, useEffectEvent, useRef, useState } from 'react';

interface UseDragListenerOptions {
    onResize: (deltaX: number) => void;
}

interface UseDragListenerResult {
    isDragging: boolean;
    handleDragStart: (e: React.MouseEvent) => void;
}

/**
 * 문서 단위 마우스 드래그를 듣고 시작점 대비 가로 이동량을 `onResize`로 넘긴다.
 *
 * `mousemove`는 화면 주사율보다 자주(고해상도 마우스는 수백 Hz) 온다. 이벤트마다
 * `onResize`를 부르면 호출부가 setState로 `ChartContent` 전체를 매번 다시 그려, 드래그가
 * 프레임당 여러 번의 렌더로 밀린다. 그래서 이동량은 ref에 모아 두고 **프레임당 한 번**
 * (`requestAnimationFrame`)만 넘긴다. 손을 뗄 때 남은 프레임은 즉시 반영해 마지막 위치를
 * 잃지 않는다.
 */
export function useDragListener({
    onResize,
}: UseDragListenerOptions): UseDragListenerResult {
    const [isDragging, setIsDragging] = useState(false);
    const dragStartXRef = useRef<number>(0);
    const latestClientXRef = useRef<number>(0);
    const pendingFrameRef = useRef<number | null>(null);

    const handleDragStart = (e: React.MouseEvent): void => {
        if (e.button !== 0) return;
        e.preventDefault();
        dragStartXRef.current = e.clientX;
        latestClientXRef.current = e.clientX;
        setIsDragging(true);
    };

    const flushResize = useEffectEvent((): void => {
        pendingFrameRef.current = null;
        onResize(latestClientXRef.current - dragStartXRef.current);
    });

    const cancelPendingFrame = useEffectEvent((): boolean => {
        if (pendingFrameRef.current === null) return false;
        cancelAnimationFrame(pendingFrameRef.current);
        pendingFrameRef.current = null;
        return true;
    });

    const handleMouseMove = useEffectEvent((e: MouseEvent) => {
        latestClientXRef.current = e.clientX;
        if (pendingFrameRef.current !== null) return;
        pendingFrameRef.current = requestAnimationFrame(() => flushResize());
    });

    const handleMouseUp = useEffectEvent(() => {
        if (cancelPendingFrame()) flushResize();
        setIsDragging(false);
    });

    useEffect(() => {
        if (!isDragging) return;

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            cancelPendingFrame();
        };
    }, [isDragging]);

    return { isDragging, handleDragStart };
}
