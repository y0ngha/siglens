'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { type ModelId } from '@y0ngha/siglens-core';
import { ModelListbox } from '@/shared/ui/ModelListbox';
import { usePopoverToggle } from '@/shared/hooks/usePopoverToggle';
import { cn } from '@/shared/lib/cn';
import { getModelDisplay } from '@/shared/lib/modelDisplay';

export interface ModelSelectProps {
    models: readonly ModelId[];
    selected: ModelId;
    onChange: (modelId: ModelId) => void;
    isHydrated: boolean;
}

/** AI 모델 listbox 드롭다운 — ChatPanel 하단 모델 선택 UI. */
export function ModelSelect({
    models,
    selected,
    onChange,
    isHydrated,
}: ModelSelectProps) {
    const t = useTranslations('widgets.chat');
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [opensUpward, setOpensUpward] = useState(true);
    const { isOpen, toggle, close } = usePopoverToggle([
        triggerRef,
        dropdownRef,
    ]);

    const selectedLabel = getModelDisplay(selected).label;

    const handleDropdownToggle = (): void => {
        if (!isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setOpensUpward(rect.top > window.innerHeight - rect.bottom);
        }
        toggle();
    };

    const closeToTrigger = (): void => {
        close();
        triggerRef.current?.focus();
    };

    return (
        <div className="relative">
            {!isHydrated ? (
                <div className="w-16 animate-pulse rounded bg-secondary-700 px-1.5 py-0.5 text-[10px]">
                    &nbsp;
                </div>
            ) : (
                <button
                    ref={triggerRef}
                    type="button"
                    onClick={handleDropdownToggle}
                    className="flex items-center gap-1 rounded bg-secondary-700 px-1.5 py-0.5 text-secondary-400 transition-colors hover:bg-secondary-600 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                    aria-label={t('ModelSelect.fb54aa')}
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
                <ModelListbox
                    ref={dropdownRef}
                    models={models}
                    selected={selected}
                    onChange={onChange}
                    onClose={closeToTrigger}
                    ariaLabel={t('ModelSelect.43807f')}
                    className={cn(
                        'left-0 min-w-40',
                        opensUpward ? 'bottom-full mb-1' : 'top-full mt-1'
                    )}
                />
            )}
        </div>
    );
}
