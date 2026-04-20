'use client';

import { useId, useRef, useState } from 'react';
import type React from 'react';
import { createPortal } from 'react-dom';
import { useOnClickOutside } from '@/components/hooks/useOnClickOutside';

/**
 * 키보드·마우스·터치 모두 접근 가능한 ⓘ 툴팁.
 *
 * - Click / Enter / Space: 열고 닫기 토글 (키보드 사용자)
 * - Pointer(마우스) hover: 열기/닫기
 * - Touch: click으로만 토글 (hover 미작동)
 * - Escape는 useOnClickOutside가 triggerRef/tooltipRef 외부 클릭으로 처리
 * - focus-visible ring으로 키보드 포커스 시각화
 *
 * 참고: MISTAKES.md Accessibility #4 — `title` 속성만으로는 키보드 사용자에게
 *       정보가 전달되지 않으므로 interactive button + 실제 툴팁 렌더가 필요하다.
 */
interface InfoTooltipProps {
    readonly children: React.ReactNode;
    /** 추가 className (접근성 아이콘 컬러 오버라이드 등). 기본값은 secondary-600. */
    readonly className?: string;
}

const TOOLTIP_VIEWPORT_PADDING = 8;
const TOOLTIP_GAP = 6;

interface TooltipPosition {
    top: number;
    left: number;
}

function getTooltipPosition(
    triggerRect: DOMRect,
    tooltipEl: HTMLElement
): TooltipPosition {
    const tooltipRect = tooltipEl.getBoundingClientRect();
    const aboveTop = triggerRect.top - tooltipRect.height - TOOLTIP_GAP;
    const top =
        aboveTop < TOOLTIP_VIEWPORT_PADDING
            ? triggerRect.bottom + TOOLTIP_GAP
            : aboveTop;
    const rawLeft =
        triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
    const maxLeft =
        window.innerWidth - tooltipRect.width - TOOLTIP_VIEWPORT_PADDING;
    const left = Math.max(TOOLTIP_VIEWPORT_PADDING, Math.min(rawLeft, maxLeft));

    return { top, left };
}

const DEFAULT_TRIGGER_CLASS =
    'text-secondary-600 hover:text-secondary-400 focus-visible:ring-primary-400 ml-1 cursor-help rounded text-xs leading-none transition-colors focus:outline-none focus-visible:ring-1';

export function InfoTooltip({
    children,
    className = DEFAULT_TRIGGER_CLASS,
}: InfoTooltipProps) {
    const tooltipId = useId();
    const [open, setOpen] = useState(false);
    const [positioned, setPositioned] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<TooltipPosition>({
        top: 0,
        left: 0,
    });

    useOnClickOutside([triggerRef, tooltipRef], () => setOpen(false), {
        enabled: open,
    });

    const handleClick = (): void => {
        if (open) {
            setOpen(false);
            setPositioned(false);
        } else {
            setOpen(true);
        }
    };

    const handlePointerEnter = (e: React.PointerEvent): void => {
        if (e.pointerType === 'touch') return;
        setOpen(true);
    };

    const handlePointerLeave = (e: React.PointerEvent): void => {
        if (e.pointerType === 'touch') return;
        setOpen(false);
        setPositioned(false);
    };

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                aria-describedby={open ? tooltipId : undefined}
                aria-label="추가 정보"
                onClick={handleClick}
                onPointerEnter={handlePointerEnter}
                onPointerLeave={handlePointerLeave}
                className={className}
            >
                ⓘ
            </button>
            {open &&
                createPortal(
                    <div
                        ref={el => {
                            tooltipRef.current = el;
                            if (el && triggerRef.current) {
                                const triggerRect =
                                    triggerRef.current.getBoundingClientRect();
                                const pos = getTooltipPosition(triggerRect, el);
                                if (
                                    pos.top !== position.top ||
                                    pos.left !== position.left
                                ) {
                                    setPosition(pos);
                                }
                                if (!positioned) setPositioned(true);
                            }
                        }}
                        id={tooltipId}
                        role="tooltip"
                        className="bg-secondary-800 border-secondary-600 fixed z-9999 rounded border p-2 text-xs leading-relaxed shadow-lg"
                        style={{
                            top: position.top,
                            left: position.left,
                            visibility: positioned ? 'visible' : 'hidden',
                        }}
                    >
                        {children}
                    </div>,
                    document.body
                )}
        </>
    );
}
