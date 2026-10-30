'use client';

/**
 * 빌딩 층 툴팁의 열림 상태 — 마우스 hover 미리보기와 클릭/탭 고정(pin)을 따로 들고, 바깥 클릭·
 * Escape·스크롤·리사이즈로 닫는다. 층 `<g>`에 붙일 포인터 핸들러를 만들어 준다.
 */
import type { MouseEvent, PointerEvent, RefObject } from 'react';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { useOnClickOutside } from '@/shared/hooks/useOnClickOutside';
import type { FloorPointer } from '../utils/positionBuildingNotes';

/** 층 하나의 `<g>`에 그대로 펼쳐 붙이는 포인터 핸들러. */
export interface FloorHandlers {
    onPointerEnter: (e: PointerEvent<SVGGElement>) => void;
    onMouseEnter: (e: MouseEvent<SVGGElement>) => void;
    onMouseLeave: () => void;
    onClick: (e: MouseEvent<SVGGElement>) => void;
}

interface UseFloorTooltipReturn {
    /** 건물 컨테이너 — 이 밖을 누르면 고정한 툴팁이 닫힌다. */
    containerRef: RefObject<HTMLDivElement | null>;
    /** 지금 툴팁을 띄울 층 — hover가 고정보다 앞선다. */
    activeFloor: FloorPointer | null;
    handlersFor: (index: number) => FloorHandlers;
}

/**
 * hover와 pin을 하나로 합치지 않는다 — 마우스로 클릭하려면 먼저 hover가 켜지므로, 합치면
 * "hover 중인 층 클릭"을 "이미 열려 있음"으로 읽어 방금 연 툴팁을 바로 닫는다.
 *
 * 터치 탭은 hover를 켜지 않는다 — 브라우저가 탭에 호환용 mouseenter를 쏘지만 mouseleave는
 * 쏘지 않아, hover로 받으면 같은 층을 다시 탭해 고정을 풀어도 툴팁이 남는다. 탭보다 먼저
 * 오는 pointerenter의 `pointerType`으로 거른다.
 *
 * 툴팁은 열 때 잰 화면 좌표(`rect`)에 `fixed`로 붙는다 — 스크롤·리사이즈 뒤엔 그 좌표가 층과
 * 어긋나므로 그때 닫는다(다시 hover/탭하면 새 좌표로 연다).
 */
export function useFloorTooltip(): UseFloorTooltipReturn {
    const [hoverFloor, setHoverFloor] = useState<FloorPointer | null>(null);
    const [pinnedFloor, setPinnedFloor] = useState<FloorPointer | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    // 마지막으로 층에 들어온 포인터 종류 — 핸들러 안에서만 읽는 값이라 ref로 둔다.
    const pointerTypeRef = useRef<string | null>(null);

    const activeFloor = hoverFloor ?? pinnedFloor;
    const isOpen = activeFloor !== null;
    const closeAll = (): void => {
        setHoverFloor(null);
        setPinnedFloor(null);
    };

    useOnClickOutside(containerRef, () => setPinnedFloor(null), {
        enabled: pinnedFloor !== null,
    });
    // WCAG 1.4.13 — 떠 있는 툴팁은 포인터를 옮기지 않고도(Escape) 닫을 수 있어야 한다.
    useEscapeKey(closeAll, isOpen);

    // 리스너는 열려 있는 동안만 붙인다 — setter는 안정적이라 `closeAll`을 그대로 쓴다.
    const close = useEffectEvent(closeAll);
    useEffect(() => {
        if (!isOpen) return;
        // capture: 페이지가 아니라 안쪽 스크롤 컨테이너가 움직여도 잡는다.
        window.addEventListener('scroll', close, {
            capture: true,
            passive: true,
        });
        window.addEventListener('resize', close);
        return () => {
            window.removeEventListener('scroll', close, { capture: true });
            window.removeEventListener('resize', close);
        };
    }, [isOpen]);

    return {
        containerRef,
        activeFloor,
        handlersFor: index => ({
            onPointerEnter: e => {
                pointerTypeRef.current = e.pointerType;
            },
            onMouseEnter: e => {
                if (pointerTypeRef.current === 'touch') return;
                setHoverFloor({
                    index,
                    rect: e.currentTarget.getBoundingClientRect(),
                });
            },
            onMouseLeave: () =>
                setHoverFloor(prev => (prev?.index === index ? null : prev)),
            onClick: e => {
                const rect = e.currentTarget.getBoundingClientRect();
                setPinnedFloor(prev =>
                    prev?.index === index ? null : { index, rect }
                );
            },
        }),
    };
}
