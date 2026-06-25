'use client';

import { useRef, useState, type PointerEvent, type RefObject } from 'react';
import {
    computeTooltipPos,
    type TooltipPosition,
} from '../utils/computeTooltipPos';

/** `useStrikeBarChart` 훅의 반환 타입. */
export interface UseStrikeBarChartReturn {
    containerRef: RefObject<HTMLDivElement | null>;
    hoveredIndex: number | null;
    tooltipPos: TooltipPosition | null;
    handlePointerEnter: (
        event: PointerEvent<SVGRectElement>,
        index: number
    ) => void;
    handlePointerMove: (
        event: PointerEvent<SVGRectElement>,
        index: number
    ) => void;
    handlePointerLeave: () => void;
}

/**
 * Strike 바 차트 공용 포인터 핸들러 훅.
 *
 * OpenInterestChart·StrikeVolumeChart 양쪽에서 동일한 reflow-회피 패턴
 * (cachedRectRef + 3-handler)을 복제하고 있어 여기로 추출한다.
 *
 * ## reflow 회피 전략
 * - pointerEnter 시 컨테이너 DOMRect를 한 번 측정해 `cachedRectRef`에 저장.
 * - pointerMove는 캐시를 읽기만 한다 — 매 move마다 `getBoundingClientRect`를
 *   부르면 레이아웃 쓰래싱이 발생해 빠른 마우스 이동 시 frame drop으로 이어진다.
 * - 모바일 touchmove처럼 enter 전에 move가 먼저 발사되는 경우에만 한 번 측정 후
 *   캐시한다.
 * - pointerLeave 시 캐시와 hover state를 모두 초기화한다.
 */
export function useStrikeBarChart(): UseStrikeBarChartReturn {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [tooltipPos, setTooltipPos] = useState<TooltipPosition | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    // 컨테이너 DOMRect 캐시 — pointerEnter에서 한 번 측정, pointerMove에서 재사용.
    const cachedRectRef = useRef<DOMRect | null>(null);

    const handlePointerEnter = (
        event: PointerEvent<SVGRectElement>,
        index: number
    ): void => {
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        cachedRectRef.current = rect;
        setHoveredIndex(index);
        setTooltipPos(computeTooltipPos(event, rect));
    };

    const handlePointerMove = (
        event: PointerEvent<SVGRectElement>,
        index: number
    ): void => {
        const rect = cachedRectRef.current;
        // enter 전에 move가 먼저 발사되는 모바일 touchmove 경로 대응 —
        // 한 번 측정해 캐시한 뒤 이후 move부터는 캐시만 읽는다.
        if (rect === null) {
            const container = containerRef.current;
            if (!container) return;
            const measured = container.getBoundingClientRect();
            cachedRectRef.current = measured;
            setHoveredIndex(index);
            setTooltipPos(computeTooltipPos(event, measured));
            return;
        }
        if (hoveredIndex !== index) setHoveredIndex(index);
        setTooltipPos(computeTooltipPos(event, rect));
    };

    const handlePointerLeave = (): void => {
        cachedRectRef.current = null;
        setHoveredIndex(null);
        setTooltipPos(null);
    };

    return {
        containerRef,
        hoveredIndex,
        tooltipPos,
        handlePointerEnter,
        handlePointerMove,
        handlePointerLeave,
    };
}
