'use client';

import { usePopoverToggle } from '@/components/hooks/usePopoverToggle';
import { isFreeChatModel } from '@/domain/llm';
import { cn } from '@/lib/cn';
import type { ModelId } from '@y0ngha/siglens-core';
import { useRef } from 'react';

interface ModelDisplay {
    label: string;
    fullName: string;
}

const MODEL_DISPLAY_MAP: Partial<Record<ModelId, ModelDisplay>> = {
    'gemini-2.5-flash-lite': {
        label: 'Flash Lite',
        fullName: 'Gemini 2.5 Flash Lite',
    },
    'gemini-2.5-flash': { label: 'Flash', fullName: 'Gemini 2.5 Flash' },
    'gemini-2.5-pro': { label: 'Pro', fullName: 'Gemini 2.5 Pro' },
    'gemini-3.1-pro-preview': {
        label: '3.1 Pro',
        fullName: 'Gemini 3.1 Pro Preview',
    },
    'gemini-3-flash-preview': {
        label: 'Flash 3',
        fullName: 'Gemini 3 Flash Preview',
    },
    'claude-haiku-3-5': { label: 'Haiku', fullName: 'Claude Haiku 3.5' },
    'claude-sonnet-4-6': { label: 'Sonnet', fullName: 'Claude Sonnet 4.6' },
    'claude-opus-4-7': { label: 'Opus', fullName: 'Claude Opus 4.7' },
    'gpt-5-mini': { label: 'GPT Mini', fullName: 'GPT-5 Mini' },
    'gpt-5.4': { label: 'GPT 5.4', fullName: 'GPT-5.4' },
    'gpt-5.5': { label: 'GPT 5.5', fullName: 'GPT-5.5' },
};

function getModelDisplay(id: ModelId): ModelDisplay {
    return MODEL_DISPLAY_MAP[id] ?? { label: id, fullName: id };
}

interface ModelSelectorProps {
    selectedModel: ModelId;
    onModelChange: (model: ModelId) => void;
    allowedModels: readonly ModelId[];
    disabled?: boolean;
}

export function ModelSelector({
    selectedModel,
    onModelChange,
    allowedModels,
    disabled = false,
}: ModelSelectorProps) {
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
    const { isOpen, toggle, close } = usePopoverToggle([
        triggerRef,
        dropdownRef,
    ]);

    const selectedDisplay = getModelDisplay(selectedModel);

    const handleToggle = () => {
        if (disabled) return;
        toggle();
        if (!isOpen) {
            const selectedIdx = allowedModels.indexOf(selectedModel);
            setTimeout(() => optionRefs.current[selectedIdx]?.focus(), 0);
        }
    };

    const handleListboxKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        const currentIndex = allowedModels.indexOf(selectedModel);
        switch (e.key) {
            case 'ArrowDown': {
                e.preventDefault();
                const nextIdx = (currentIndex + 1) % allowedModels.length;
                onModelChange(allowedModels[nextIdx]!);
                optionRefs.current[nextIdx]?.focus();
                break;
            }
            case 'ArrowUp': {
                e.preventDefault();
                const prevIdx =
                    (currentIndex - 1 + allowedModels.length) %
                    allowedModels.length;
                onModelChange(allowedModels[prevIdx]!);
                optionRefs.current[prevIdx]?.focus();
                break;
            }
            case 'Home':
                e.preventDefault();
                onModelChange(allowedModels[0]!);
                optionRefs.current[0]?.focus();
                break;
            case 'End': {
                e.preventDefault();
                const lastIdx = allowedModels.length - 1;
                onModelChange(allowedModels[lastIdx]!);
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
        <div className="mb-4 flex flex-row items-center gap-3">
            <span className="text-secondary-500 text-xs font-medium tracking-[0.15em] whitespace-nowrap uppercase">
                AI MODEL
            </span>
            <div className="relative flex-1">
                <button
                    ref={triggerRef}
                    type="button"
                    onClick={handleToggle}
                    disabled={disabled}
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                    aria-label="AI 분석 모델 선택"
                    className={cn(
                        'border-secondary-700 hover:bg-secondary-700/30 focus-visible:ring-primary-500 flex w-full items-center justify-between rounded-md border px-3 py-2 transition-colors focus-visible:ring-1 focus-visible:outline-none',
                        disabled && 'cursor-not-allowed opacity-60'
                    )}
                >
                    <span className="text-secondary-300 text-xs font-medium">
                        {selectedDisplay.label}
                    </span>
                    <span
                        className={cn(
                            'text-secondary-500 text-xs transition-transform duration-150',
                            isOpen && 'rotate-180'
                        )}
                        aria-hidden="true"
                    >
                        ▾
                    </span>
                </button>

                {isOpen && (
                    <div
                        ref={dropdownRef}
                        role="listbox"
                        aria-label="AI 분석 모델 목록"
                        onKeyDown={handleListboxKeyDown}
                        className="border-secondary-600 bg-secondary-800 absolute top-full left-0 z-10 mt-1 w-full rounded-lg border shadow-lg"
                    >
                        <div className="max-h-66 overflow-y-auto overscroll-contain">
                            {allowedModels.map((modelId, i) => {
                                const display = getModelDisplay(modelId);
                                const isSelected = modelId === selectedModel;
                                return (
                                    <div
                                        key={modelId}
                                        ref={el => {
                                            optionRefs.current[i] = el;
                                        }}
                                        role="option"
                                        tabIndex={isSelected ? 0 : -1}
                                        aria-selected={isSelected}
                                        onClick={() => {
                                            onModelChange(modelId);
                                            close();
                                            triggerRef.current?.focus();
                                        }}
                                        onKeyDown={e => {
                                            if (
                                                e.key === 'Enter' ||
                                                e.key === ' '
                                            ) {
                                                e.preventDefault();
                                                onModelChange(modelId);
                                                close();
                                                triggerRef.current?.focus();
                                            }
                                        }}
                                        className={cn(
                                            'focus-visible:ring-primary-500 flex min-h-11 w-full cursor-pointer items-center gap-2 px-3 transition-colors focus-visible:ring-1 focus-visible:outline-none',
                                            isSelected
                                                ? 'text-primary-300 bg-primary-900/20'
                                                : 'text-secondary-300 hover:bg-secondary-700'
                                        )}
                                    >
                                        <span className="w-3 text-[10px]">
                                            {isSelected && '✓'}
                                        </span>
                                        <div className="flex flex-1 items-center justify-between gap-2">
                                            <div>
                                                <div className="text-[11px] font-medium">
                                                    {display.label}
                                                </div>
                                                <div className="text-secondary-500 text-[10px]">
                                                    {display.fullName}
                                                </div>
                                            </div>
                                            {!isFreeChatModel(modelId) && (
                                                <span className="text-ui-warning text-[9px] leading-none font-semibold uppercase">
                                                    PRO
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
