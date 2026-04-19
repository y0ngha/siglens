'use client';

import { useCallback } from 'react';
import { cn } from '@/lib/cn';

interface StrictModeToggleProps {
    strict: boolean;
    onChange: (next: boolean) => void;
}

const OPTIONS = [
    { value: true, label: '엄격' },
    { value: false, label: '완화' },
] as const;

export function StrictModeToggle({ strict, onChange }: StrictModeToggleProps) {
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLButtonElement>) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                onChange(!strict);
            }
        },
        [onChange, strict]
    );

    return (
        <div className="flex items-baseline gap-3">
            <span
                id="strict-mode-label"
                className="text-secondary-500 text-[10px] tracking-wider uppercase"
            >
                모드
            </span>
            <div
                role="radiogroup"
                aria-labelledby="strict-mode-label"
                className="flex gap-3"
            >
                {OPTIONS.map(opt => {
                    const isActive = opt.value === strict;
                    return (
                        <button
                            key={String(opt.value)}
                            role="radio"
                            aria-checked={isActive}
                            tabIndex={isActive ? 0 : -1}
                            onClick={() => onChange(opt.value)}
                            onKeyDown={handleKeyDown}
                            className={cn(
                                'min-h-11 touch-manipulation border-b-2 px-2 pt-2 pb-2 text-xs font-semibold tracking-[0.12em] uppercase transition-colors duration-150',
                                isActive
                                    ? 'text-secondary-100 border-primary-500'
                                    : 'text-secondary-500 border-transparent hover:text-secondary-300',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-t'
                            )}
                        >
                            {opt.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
