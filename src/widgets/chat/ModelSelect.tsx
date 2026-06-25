'use client';

import { useRef, useState } from 'react';
import type { ModelId } from '@y0ngha/siglens-core';
import { isFreeModel } from '@y0ngha/siglens-core';
import { usePopoverToggle } from '@/shared/hooks/usePopoverToggle';
import { cn } from '@/shared/lib/cn';

export interface ModelOption {
    id: ModelId;
    label: string;
    fullName: string;
}

export interface ModelSelectProps {
    options: readonly ModelOption[];
    selected: ModelId;
    onChange: (modelId: ModelId) => void;
    isHydrated: boolean;
}

/** AI 모델 listbox 드롭다운 — ChatPanel 하단 모델 선택 UI. */
export function ModelSelect({
    options,
    selected,
    onChange,
    isHydrated,
}: ModelSelectProps): React.ReactElement {
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
    const [opensUpward, setOpensUpward] = useState(true);
    const { isOpen, toggle, close } = usePopoverToggle([
        triggerRef,
        dropdownRef,
    ]);

    const selectedOption = options.find(o => o.id === selected);
    const selectedLabel = selectedOption?.label ?? selected;

    const handleDropdownToggle = (): void => {
        if (!isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setOpensUpward(rect.top > window.innerHeight - rect.bottom);
        }
        toggle();
        if (!isOpen) {
            const selectedIdx = options.findIndex(opt => opt.id === selected);
            setTimeout(() => optionRefs.current[selectedIdx]?.focus(), 0);
        }
    };

    const handleListboxKeyDown = (
        e: React.KeyboardEvent<HTMLDivElement>
    ): void => {
        const currentIndex = options.findIndex(opt => opt.id === selected);
        switch (e.key) {
            case 'ArrowDown': {
                e.preventDefault();
                const nextIdx = (currentIndex + 1) % options.length;
                onChange(options[nextIdx]!.id);
                optionRefs.current[nextIdx]?.focus();
                break;
            }
            case 'ArrowUp': {
                e.preventDefault();
                const prevIdx =
                    (currentIndex - 1 + options.length) % options.length;
                onChange(options[prevIdx]!.id);
                optionRefs.current[prevIdx]?.focus();
                break;
            }
            case 'Home':
                e.preventDefault();
                onChange(options[0]!.id);
                optionRefs.current[0]?.focus();
                break;
            case 'End': {
                e.preventDefault();
                const lastIdx = options.length - 1;
                onChange(options[lastIdx]!.id);
                optionRefs.current[lastIdx]?.focus();
                break;
            }
            case 'Escape':
                e.preventDefault();
                close();
                triggerRef.current?.focus();
                break;
        }
    };

    return (
        <div className="relative">
            {!isHydrated ? (
                <div className="bg-secondary-700 w-16 animate-pulse rounded px-1.5 py-0.5 text-[10px]">
                    &nbsp;
                </div>
            ) : (
                <button
                    ref={triggerRef}
                    type="button"
                    onClick={handleDropdownToggle}
                    className="bg-secondary-700 hover:bg-secondary-600 text-secondary-400 focus-visible:ring-primary-500 flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors focus-visible:ring-1 focus-visible:outline-none"
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                    aria-label="AI 모델 선택"
                >
                    <span>{selectedLabel}</span>
                    <span
                        className={cn(
                            'transition-transform duration-150',
                            isOpen && 'rotate-180'
                        )}
                        aria-hidden="true"
                    >
                        ▾
                    </span>
                </button>
            )}

            {isOpen && (
                <div
                    ref={dropdownRef}
                    role="listbox"
                    aria-label="AI 모델 목록"
                    onKeyDown={handleListboxKeyDown}
                    className={cn(
                        'border-secondary-600 bg-secondary-800 absolute left-0 z-10 min-w-40 rounded-lg border shadow-lg',
                        opensUpward ? 'bottom-full mb-1' : 'top-full mt-1'
                    )}
                >
                    <div className="max-h-66 overflow-y-auto overscroll-contain">
                        {options.map((option, i) => (
                            <div
                                key={option.id}
                                ref={el => {
                                    optionRefs.current[i] = el;
                                }}
                                role="option"
                                tabIndex={selected === option.id ? 0 : -1}
                                aria-selected={selected === option.id}
                                onClick={() => {
                                    onChange(option.id);
                                    close();
                                    triggerRef.current?.focus();
                                }}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        onChange(option.id);
                                        close();
                                        triggerRef.current?.focus();
                                    }
                                }}
                                className={cn(
                                    'focus-visible:ring-primary-500 flex min-h-11 w-full cursor-pointer items-center gap-2 px-3 transition-colors focus-visible:ring-1 focus-visible:outline-none',
                                    selected === option.id
                                        ? 'text-primary-300 bg-primary-900/20'
                                        : 'text-secondary-300 hover:bg-secondary-700'
                                )}
                            >
                                <span className="w-3 text-[10px]">
                                    {selected === option.id && '✓'}
                                </span>
                                <div className="flex flex-1 items-center justify-between gap-2">
                                    <div>
                                        <div className="text-[11px] font-medium">
                                            {option.label}
                                        </div>
                                        <div className="text-secondary-500 text-[10px]">
                                            {option.fullName}
                                        </div>
                                    </div>
                                    {!isFreeModel(option.id) && (
                                        <span className="text-ui-warning text-[9px] leading-none font-semibold uppercase">
                                            PRO
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
