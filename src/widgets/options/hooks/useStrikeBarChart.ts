'use client';

import { useRef, useState, type PointerEvent, type RefObject } from 'react';
import {
    computeTooltipPos,
    type TooltipPosition,
} from '../utils/computeTooltipPos';

/** Return shape of `useStrikeBarChart`. */
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
 * Shared pointer handlers for the strike bar charts (OI and volume).
 *
 * Enter and move both measure the container rect at the moment of the event.
 * The rect is deliberately not cached across moves: scrolling while the
 * pointer rests on a bar moves the container without a pointer event, so a
 * cached rect would anchor the tooltip to the pre-scroll position. One
 * `getBoundingClientRect` read per pointer event is cheap (no layout writes
 * happen between the read and the state updates).
 */
export function useStrikeBarChart(): UseStrikeBarChartReturn {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [tooltipPos, setTooltipPos] = useState<TooltipPosition | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const showTooltipAt = (
        event: PointerEvent<SVGRectElement>,
        index: number
    ): void => {
        const container = containerRef.current;
        if (!container) return;
        setHoveredIndex(index);
        setTooltipPos(
            computeTooltipPos(event, container.getBoundingClientRect())
        );
    };

    const handlePointerLeave = (): void => {
        setHoveredIndex(null);
        setTooltipPos(null);
    };

    return {
        containerRef,
        hoveredIndex,
        tooltipPos,
        handlePointerEnter: showTooltipAt,
        handlePointerMove: showTooltipAt,
        handlePointerLeave,
    };
}
