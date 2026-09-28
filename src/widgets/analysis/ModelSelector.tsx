'use client';

import { useTranslations } from 'next-intl';
import { usePopoverToggle } from '@/shared/hooks/usePopoverToggle';
import { cn } from '@/shared/lib/cn';
import { getModelDisplay } from '@/shared/lib/modelDisplay';
import { type ModelId } from '@y0ngha/siglens-core';
import { ModelListbox } from '@/shared/ui/ModelListbox';
import { useRef } from 'react';

interface ModelSelectorProps {
    selectedModel: ModelId;
    onModelChange: (model: ModelId) => void;
    allowedModels: readonly ModelId[];
    disabled?: boolean;
    /** Outer wrapper className. Defaults to `"mb-4"` when omitted. */
    className?: string;
    /** Show the "AI MODEL" label to the left of the trigger. Defaults to `true`. */
    showLabel?: boolean;
    /** Dropdown opening direction. Defaults to `"left"`. */
    dropdownAlign?: 'left' | 'right';
}

export function ModelSelector({
    selectedModel,
    onModelChange,
    allowedModels,
    disabled = false,
    className = 'mb-4',
    showLabel = true,
    dropdownAlign = 'left',
}: ModelSelectorProps) {
    const t = useTranslations('widgets.analysis');
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { isOpen, toggle, close } = usePopoverToggle([
        triggerRef,
        dropdownRef,
    ]);

    const selectedDisplay = getModelDisplay(selectedModel);

    const handleToggle = () => {
        if (disabled) return;
        toggle();
    };

    const closeToTrigger = () => {
        close();
        triggerRef.current?.focus();
    };

    return (
        <div className={cn('flex flex-row items-center gap-3', className)}>
            {showLabel && (
                <span className="text-xs font-medium tracking-[0.15em] whitespace-nowrap text-secondary-400 uppercase">
                    AI MODEL
                </span>
            )}
            <div className="relative min-w-0 flex-1">
                <button
                    ref={triggerRef}
                    type="button"
                    onClick={handleToggle}
                    disabled={disabled}
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                    aria-label={t('ModelSelector.1db1df')}
                    className={cn(
                        'border-border-control hover:bg-secondary-700/30 focus-visible:ring-primary-500 flex min-h-11 w-full touch-manipulation items-center justify-between rounded-lg border px-3 py-2 transition-colors focus-visible:ring-1 focus-visible:outline-none',
                        disabled && 'cursor-not-allowed opacity-60'
                    )}
                >
                    <span className="truncate text-xs font-medium text-secondary-300">
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
                    <ModelListbox
                        ref={dropdownRef}
                        models={allowedModels}
                        selected={selectedModel}
                        onChange={onModelChange}
                        onClose={closeToTrigger}
                        ariaLabel={t('ModelSelector.7c0e87')}
                        className={cn(
                            'top-full mt-1 w-full min-w-44',
                            dropdownAlign === 'right' ? 'right-0' : 'left-0'
                        )}
                    />
                )}
            </div>
        </div>
    );
}
