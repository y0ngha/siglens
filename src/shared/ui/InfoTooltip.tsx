'use client';

import { useTranslations } from 'next-intl';
import type React from 'react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { useOnClickOutside } from '@/shared/hooks/useOnClickOutside';
import {
    getTooltipPosition,
    type TooltipPosition,
} from '@/shared/lib/tooltipPosition';
import { cn } from '@/shared/lib/cn';

// 키보드·마우스·터치 접근 가능한 ⓘ disclosure 툴팁 — WCAG 2.1 SC 1.4.13 준수.
interface InfoTooltipProps {
    readonly children: ReactNode;
    /** 추가 className. 기본 접근성 클래스(focus-visible ring 등)에 병합된다. */
    readonly className?: string;
}

/**
 * 트리거와 툴팁 사이에 `TOOLTIP_GAP`만큼 빈틈이 있어, 포인터가 그 틈을 건너는 동안
 * 닫히지 않도록 두는 유예(ms). 툴팁 위로 올라가면 취소된다(WCAG 1.4.13 hoverable).
 */
export const TOOLTIP_CLOSE_DELAY_MS = 150;

const DEFAULT_TRIGGER_CLASS =
    'inline-flex items-center justify-center min-h-6 min-w-6 text-secondary-400 hover:text-secondary-200 focus-visible:ring-primary-400 ml-1 cursor-help rounded text-xs leading-none transition-colors focus:outline-none focus-visible:ring-2';

export function InfoTooltip({ children, className }: InfoTooltipProps) {
    const t = useTranslations('shared.ui');
    const tooltipId = useId();
    const [open, setOpen] = useState(false);
    const [positioned, setPositioned] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [position, setPosition] = useState<TooltipPosition>({
        top: 0,
        left: 0,
    });

    // 닫힘 지연 타이머 해제. ref만 다루므로 렌더마다 같은 함수로 유지한다.
    const cancelClose = useCallback((): void => {
        if (closeTimerRef.current === null) return;
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
    }, []);

    useOnClickOutside(
        [triggerRef, tooltipRef],
        () => {
            cancelClose();
            setOpen(false);
        },
        { enabled: open }
    );

    // WCAG 2.1 SC 1.4.13 — 열린 툴팁은 Escape로 닫을 수 있어야 한다.
    // useOnClickOutside는 포인터 이벤트만 처리하므로 키보드 사용자용 경로가 별도로 필요하다.
    useEscapeKey(() => {
        cancelClose();
        setOpen(false);
        setPositioned(false);
    }, open);

    const handleClick = (): void => {
        cancelClose();
        if (open) {
            setOpen(false);
            setPositioned(false);
        } else {
            setOpen(true);
        }
    };

    const handlePointerEnter = (e: React.PointerEvent): void => {
        if (e.pointerType === 'touch') return;
        cancelClose();
        setOpen(true);
    };

    const handlePointerLeave = (e: React.PointerEvent): void => {
        if (e.pointerType === 'touch') return;
        cancelClose();
        closeTimerRef.current = setTimeout(() => {
            closeTimerRef.current = null;
            setOpen(false);
            setPositioned(false);
        }, TOOLTIP_CLOSE_DELAY_MS);
    };

    // 언마운트 뒤 대기 중인 닫힘 타이머가 상태를 건드리지 않게 정리한다.
    useEffect(() => cancelClose, [cancelClose]);

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                aria-label={t('InfoTooltip.9b3193')}
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
                        // 트리거와 툴팁은 하나의 호버 영역이라 터치 제외와 지연 닫기를
                        // 같은 핸들러로 공유한다.
                        onPointerEnter={handlePointerEnter}
                        onPointerLeave={handlePointerLeave}
                        className={cn(
                            'bg-secondary-800 border-secondary-600 fixed top-(--tt) left-(--tl) z-9999 max-w-xs rounded border p-2 text-xs leading-relaxed shadow-lg',
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
