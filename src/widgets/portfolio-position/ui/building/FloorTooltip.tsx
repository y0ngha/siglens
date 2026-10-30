'use client';

/**
 * 층 floating 툴팁 — `document.body`로 포털해 SVG 경계에 잘리지 않게 하고, 활성 층의 화면 좌표 옆에
 * `fixed`로 띄운다. 처음 잴 때까지는 숨겨 둔다(InfoTooltip과 같은 방식).
 */
import type { CSSProperties } from 'react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/shared/lib/cn';
import {
    getTooltipPosition,
    type TooltipPosition,
} from '@/shared/lib/tooltipPosition';
import type { FloorTooltipContent } from '../../utils/positionBuildingNotes';

interface FloorTooltipProps {
    /** 층 `<g>`의 화면 좌표 — 열 때 잰 값. */
    readonly anchorRect: DOMRect;
    readonly content: FloorTooltipContent;
}

/**
 * 층이 바뀔 때마다 새로 마운트한다(호출부 `key`) — 그래서 "아직 안 쟀음" 상태가 층마다 저절로
 * 처음으로 돌아간다. `pointer-events-none`이라 툴팁을 눌러도 바깥 클릭 판정에 끼지 않는다.
 *
 * role="tooltip"이 아니라 aria-hidden이다 — 포털된 노드는 svg role="img" 밖에 살고, role="tooltip"은
 * 트리거의 aria-describedby로 이어져야 하는데(REACT.md#AX-2) 층은 의도적으로 포커스할 수 없어
 * 트리거가 없다. 트리거 없는 tooltip은 뜬금없이 읽히는 고아 노드가 된다. 같은 정보는 svg aria-label이 준다.
 */
export function FloorTooltip({ anchorRect, content }: FloorTooltipProps) {
    const [position, setPosition] = useState<TooltipPosition | null>(null);
    if (typeof document === 'undefined') return null;
    return createPortal(
        <div
            ref={el => {
                if (!el) return;
                const next = getTooltipPosition(
                    anchorRect,
                    el.getBoundingClientRect(),
                    window.innerWidth
                );
                if (next.top !== position?.top || next.left !== position?.left)
                    setPosition(next);
            }}
            aria-hidden="true"
            data-testid="floor-tooltip"
            className={cn(
                'bg-secondary-800 border-secondary-600 pointer-events-none fixed top-(--tt) left-(--tl) z-9999 max-w-[220px] rounded border p-2 text-xs leading-relaxed shadow-lg',
                position === null ? 'invisible' : 'visible'
            )}
            style={
                {
                    '--tt': `${position?.top ?? 0}px`,
                    '--tl': `${position?.left ?? 0}px`,
                } as CSSProperties
            }
        >
            <p className="font-medium text-secondary-100 tabular-nums">
                {content.main}
            </p>
            <p className="mt-0.5 text-[10px] text-secondary-400">
                {content.qualifier}
            </p>
        </div>,
        document.body
    );
}
