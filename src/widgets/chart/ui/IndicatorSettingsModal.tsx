'use client';

import type { CSSProperties } from 'react';
import { useId, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useDialog } from '@/shared/hooks/useDialog';
import { cn } from '@/shared/lib/cn';
import { getPeriodColor } from '@/shared/lib/chartColors';
import {
    groupBindingsByCategory,
    type IndicatorBinding,
} from '../model/indicatorRegistry';

interface IndicatorSettingsModalProps {
    bindings: IndicatorBinding[];
}

interface IndicatorRowProps {
    binding: IndicatorBinding;
}

const ROW_CLASS =
    'flex items-center gap-2 rounded px-2 py-1.5 text-sm text-secondary-200';

function GearIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
        >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
        </svg>
    );
}

function PeriodChips({ binding }: IndicatorRowProps) {
    const {
        availablePeriods = [],
        visiblePeriods = [],
        onTogglePeriod,
    } = binding;

    return (
        <div className="flex flex-wrap gap-1">
            {availablePeriods.map(period => {
                const selected = visiblePeriods.includes(period);
                return (
                    <button
                        key={period}
                        type="button"
                        onClick={() => onTogglePeriod?.(period)}
                        aria-pressed={selected}
                        className={cn(
                            'focus-visible:ring-primary-500 flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors focus-visible:ring-1 focus-visible:outline-none',
                            selected
                                ? 'bg-secondary-700 text-white'
                                : 'text-secondary-400 hover:bg-secondary-700 hover:text-white'
                        )}
                    >
                        <span
                            className="h-2 w-2 shrink-0 rounded-full bg-[var(--chip-color)]"
                            style={
                                {
                                    '--chip-color': getPeriodColor(period),
                                } as CSSProperties
                            }
                        />
                        {period}
                    </button>
                );
            })}
        </div>
    );
}

function PeriodRow({ binding }: IndicatorRowProps) {
    return (
        <div className={ROW_CLASS}>
            <span
                className={cn(
                    'w-16 shrink-0 font-medium',
                    binding.active ? 'text-white' : 'text-secondary-400'
                )}
            >
                {binding.meta.label}
            </span>
            <PeriodChips binding={binding} />
        </div>
    );
}

function ToggleRow({ binding }: IndicatorRowProps) {
    return (
        <label className={cn(ROW_CLASS, 'cursor-pointer')}>
            <input
                type="checkbox"
                checked={binding.active}
                // onToggle은 타입상 optional이라 undefined면 controlled input이
                // read-only가 되고 React 경고가 난다. no-op으로 controlled 유지.
                onChange={() => binding.onToggle?.()}
                className="accent-primary-500 h-4 w-4"
            />
            <span>{binding.meta.label}</span>
        </label>
    );
}

export function IndicatorSettingsModal({
    bindings,
}: IndicatorSettingsModalProps) {
    const { isOpen, open, close, dialogRef, triggerRef } = useDialog();
    // 같은 페이지에 여러 차트가 렌더되어도 dialog title id가 충돌하지 않도록
    // 인스턴스별 고유 id를 생성한다 (aria-labelledby 무결성 보장).
    const titleId = useId();
    const groups = useMemo(() => groupBindingsByCategory(bindings), [bindings]);

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={open}
                aria-label="보조지표 설정"
                aria-haspopup="dialog"
                className="bg-secondary-900/85 text-secondary-400 hover:bg-secondary-700/90 focus-visible:ring-primary-500 flex h-11 w-11 touch-manipulation items-center justify-center rounded-lg backdrop-blur-sm transition-colors hover:text-white focus-visible:ring-1 focus-visible:outline-none"
            >
                <GearIcon />
            </button>

            {isOpen &&
                createPortal(
                    <div
                        className="bg-secondary-950/80 fixed inset-0 z-60 flex items-center justify-center overscroll-contain p-4 backdrop-blur-sm"
                        role="presentation"
                    >
                        <div
                            ref={dialogRef}
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby={titleId}
                            tabIndex={-1}
                            className="border-secondary-700 bg-secondary-800 max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl border text-left shadow-2xl outline-none"
                        >
                            <div className="border-secondary-700 flex items-start justify-between border-b px-5 py-4">
                                <h2
                                    id={titleId}
                                    className="text-secondary-100 text-base font-semibold"
                                >
                                    보조지표 설정
                                </h2>
                                <button
                                    type="button"
                                    onClick={close}
                                    aria-label="닫기"
                                    className="text-secondary-500 hover:text-secondary-300 focus-visible:ring-primary-500 -mt-1 -mr-1 rounded p-1 transition-colors focus-visible:ring-1 focus-visible:outline-none"
                                >
                                    <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                    >
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>

                            <div className="flex flex-col gap-4 p-5">
                                {groups.map(group => (
                                    <section key={group.category}>
                                        <h3 className="text-secondary-500 mb-1 text-xs font-semibold tracking-wide uppercase">
                                            {group.label}
                                        </h3>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                                            {group.items.map(binding =>
                                                binding.meta.hasPeriods ? (
                                                    <div
                                                        key={binding.meta.key}
                                                        className="col-span-2"
                                                    >
                                                        <PeriodRow
                                                            binding={binding}
                                                        />
                                                    </div>
                                                ) : (
                                                    <ToggleRow
                                                        key={binding.meta.key}
                                                        binding={binding}
                                                    />
                                                )
                                            )}
                                        </div>
                                    </section>
                                ))}
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </>
    );
}
