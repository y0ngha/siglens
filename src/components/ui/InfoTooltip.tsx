'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type React from 'react';
import { createPortal } from 'react-dom';
import { useOnClickOutside } from '@/components/hooks/useOnClickOutside';
import {
    getTooltipPosition,
    type TooltipPosition,
} from '@/components/ui/utils/tooltipPosition';
import { cn } from '@/lib/cn';

/**
 * 키보드·마우스·터치 모두 접근 가능한 ⓘ 툴팁 (disclosure 패턴).
 *
 * - Click / Enter / Space: 열고 닫기 토글 (키보드·마우스)
 * - Pointer(마우스) hover: 열기 / leave 시 닫기
 * - Touch: click으로만 토글 (hover 미작동)
 * - **Escape 키**: 열린 상태에서 닫기 (WCAG 2.1 SC 1.4.13)
 * - `aria-expanded`로 disclosure 상태를 스크린리더에 노출
 * - `focus-visible ring`으로 키보드 포커스 시각화
 *
 * 참고: MISTAKES.md Accessibility #4 — `title` 속성만으로는 키보드 사용자에게
 *       정보가 전달되지 않으므로 interactive button + 실제 툴팁 렌더가 필요하다.
 */
interface InfoTooltipProps {
    readonly children: React.ReactNode;
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
    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') {
                setOpen(false);
                setPositioned(false);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open]);

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
