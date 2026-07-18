'use client';

import { useEffect, useRef } from 'react';
import { DEEPSEEK_V4_FLASH_MODEL, type ModelId } from '@y0ngha/siglens-core';
import { ReasoningToggle } from '@/features/reasoning-toggle';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { usePopoverToggle } from '@/shared/hooks/usePopoverToggle';
import { cn } from '@/shared/lib/cn';
import { ModelSelector } from './ModelSelector';

interface AnalysisSettingsMenuProps {
    modelId: ModelId;
    allowedModels: readonly ModelId[];
    handleModelChange: (model: ModelId) => void;
    reasoning: boolean;
    setReasoning: (value: boolean) => void;
    canUseReasoning: boolean;
    openSignupNudge: () => void;
}

/** Gear glyph — reuses the house-style outline gear from `IndicatorSettingsModal`'s chart toolbar trigger so both "settings" affordances in the app read as the same icon language. */
function GearIcon({ className = 'h-5 w-5' }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden="true"
        >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
        </svg>
    );
}

/**
 * "분석 설정" gear popover — consolidates the AI model selector and the
 * reasoning ("상세 분석") toggle behind a single trigger so the symbol-page
 * header (`SymbolLayoutHeader`) doesn't need a dedicated wide selector +
 * switch pair sitting directly in its control row.
 *
 * Both children are the SAME `ModelSelector` / `ReasoningToggle` components
 * used elsewhere — this widget only relocates them into an anchored panel,
 * it does not reimplement any of their gating/interaction logic (PRO gate,
 * locked-switch signup nudge, etc. all still flow through the props exactly
 * as before).
 */
export function AnalysisSettingsMenu({
    modelId,
    allowedModels,
    handleModelChange,
    reasoning,
    setReasoning,
    canUseReasoning,
    openSignupNudge,
}: AnalysisSettingsMenuProps) {
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const { isOpen, toggle, close } = usePopoverToggle([triggerRef, panelRef]);

    // Active = a non-default choice is in effect: reasoning turned on, or a
    // model other than the app-wide default free model is selected. Read
    // from the same source of truth `useSelectedModel` falls back to
    // (`DEEPSEEK_V4_FLASH_MODEL`) rather than hardcoding a model id here.
    const isActive = reasoning || modelId !== DEEPSEEK_V4_FLASH_MODEL;

    const handleClose = (): void => {
        close();
        triggerRef.current?.focus();
    };

    useEscapeKey(handleClose, isOpen);

    // On open, hand focus to the first focusable control inside the panel —
    // the ModelSelector's own trigger button is rendered first, before the
    // ReasoningToggle's tooltip/switch buttons, so a plain "first button in
    // the panel" query reaches it without needing ModelSelector to forward
    // a ref (it doesn't, and we're not reimplementing it to add one).
    useEffect(() => {
        if (!isOpen) return;
        const id = setTimeout(() => {
            panelRef.current?.querySelector('button')?.focus();
        }, 0);
        return () => clearTimeout(id);
    }, [isOpen]);

    return (
        <div className="relative">
            <button
                ref={triggerRef}
                type="button"
                onClick={toggle}
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                aria-label={isActive ? '분석 설정 (변경됨)' : '분석 설정'}
                className={cn(
                    'border-secondary-700 text-secondary-300 relative inline-flex size-11 items-center justify-center rounded-lg border',
                    'hover:border-secondary-600 hover:bg-secondary-700/30 hover:text-secondary-100',
                    'focus-visible:ring-primary-500 focus-visible:ring-2 focus-visible:outline-none',
                    'touch-manipulation transition-colors'
                )}
            >
                <GearIcon />
                {isActive && (
                    <span
                        aria-hidden="true"
                        className="bg-primary-500 absolute -top-0.5 -right-0.5 size-1.5 rounded-full"
                    />
                )}
            </button>

            {isOpen && (
                <div
                    ref={panelRef}
                    role="dialog"
                    aria-label="분석 설정"
                    className="border-secondary-600 bg-secondary-800 absolute top-full right-0 z-50 mt-1 flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-3 overscroll-contain rounded-lg border p-3 shadow-lg"
                >
                    <h2 className="text-secondary-100 text-xs font-semibold tracking-wide">
                        분석 설정
                    </h2>
                    <ModelSelector
                        selectedModel={modelId}
                        onModelChange={handleModelChange}
                        allowedModels={allowedModels}
                        className="w-full"
                    />
                    <ReasoningToggle
                        checked={reasoning}
                        onChange={setReasoning}
                        canUse={canUseReasoning}
                        onLockedClick={openSignupNudge}
                    />
                </div>
            )}
        </div>
    );
}
