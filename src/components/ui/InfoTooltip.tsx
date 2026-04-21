'use client';

import { ReactNode, useId, useRef, useState } from 'react';
import type React from 'react';
import { createPortal } from 'react-dom';
import { useEscapeKey } from '@/components/hooks/useEscapeKey';
import { useOnClickOutside } from '@/components/hooks/useOnClickOutside';
import {
    getTooltipPosition,
    type TooltipPosition,
} from '@/lib/tooltipPosition';
import { cn } from '@/lib/cn';

// 키보드·마우스·터치 접근 가능한 ⓘ disclosure 툴팁 — WCAG 2.1 SC 1.4.13 준수.
interface InfoTooltipProps {
    readonly children: ReactNode;
    /** 추가 className. 기본 접근성 클래스(focus-visible ring 등)에 병합된다. */
    readonly className?: string;
}

const DEFAULT_TRIGGER_CLASS =
    'text-secondary-600 hover:text-secondary-400 focus-visible:ring-primary-400 ml-1 cursor-help rounded text-xs leading-none transition-colors focus:outline-none focus-visible:ring-1';

export function InfoTooltip({ children, className }: InfoTooltipProps) {
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

    // WCAG 2.1 SC 1.4.13 — 열린 툴팁은 Escape로 닫을 수 있어야 한다.
    // useOnClickOutside는 포인터 이벤트만 처리하므로 키보드 사용자용 경로가 별도로 필요하다.
    useEscapeKey(() => {
        setOpen(false);
        setPositioned(false);
    }, open);

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
                aria-label="추가 정보"
                aria-describedby={open ? tooltipId : undefined}
                aria-expanded={open}
                onClick={handleClick}
                onPointerEnter={handlePointerEnter}
                onPointerLeave={handlePointerLeave}
                className={cn(DEFAULT_TRIGGER_CLASS, className)}
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
                                const tooltipRect = el.getBoundingClientRect();
                                const pos = getTooltipPosition(
                                    triggerRect,
                                    tooltipRect,
                                    window.innerWidth
                                );
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
                        className={cn(
                            'bg-secondary-800 border-secondary-600 fixed top-[var(--tt)] left-[var(--tl)] z-9999 rounded border p-2 text-xs leading-relaxed shadow-lg',
                            positioned ? 'visible' : 'invisible'
                        )}
                        style={
                            {
                                '--tt': `${position.top}px`,
                                '--tl': `${position.left}px`,
                            } as React.CSSProperties
                        }
                    >
                        {children}
                    </div>,
                    document.body
                )}
        </>
    );
}
