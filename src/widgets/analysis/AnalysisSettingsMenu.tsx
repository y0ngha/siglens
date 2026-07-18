'use client';

import { useId, useRef } from 'react';
import { DEEPSEEK_V4_FLASH_MODEL, type ModelId } from '@y0ngha/siglens-core';
import { ReasoningToggle } from '@/features/reasoning-toggle';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { usePopoverToggle } from '@/shared/hooks/usePopoverToggle';
import { cn } from '@/shared/lib/cn';
import { getModelDisplay } from '@/shared/lib/modelDisplay';
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
    const titleId = useId();
    const { isOpen, toggle, close } = usePopoverToggle([triggerRef, panelRef]);

    // Active = a non-default choice is in effect: reasoning turned on, or a
    // model other than the app-wide default free model is selected. Read
    // from the same source of truth `useSelectedModel` falls back to
    // (`DEEPSEEK_V4_FLASH_MODEL`) rather than hardcoding a model id here.
    const isActive = reasoning || modelId !== DEEPSEEK_V4_FLASH_MODEL;

    // Same source ModelSelector reads its own trigger label from — the gear's
    // accessible name/title surface the active model without widening the
    // header row back out (declutter is intentional; see module doc).
    const modelDisplay = getModelDisplay(modelId);
    const accessibleLabel = isActive
        ? `분석 설정 · 현재 모델: ${modelDisplay.label} (변경됨)`
        : `분석 설정 · 현재 모델: ${modelDisplay.label}`;

    // Mirrors PortfolioChipPopover: a focus trap owns initial focus, Tab
    // cycling, and restoring focus to the trigger on EVERY close path
    // (Escape, click-outside, re-toggle) via its unmount/deactivate cleanup,
    // so we don't hand-roll a partial (Escape-only) restore here.
    useFocusTrap(panelRef, isOpen);
    useEscapeKey(close, isOpen);

    return (
        <div className="relative">
            <button
                ref={triggerRef}
                type="button"
                onClick={toggle}
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                aria-label={accessibleLabel}
                title={accessibleLabel}
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
                    aria-labelledby={titleId}
                    tabIndex={-1}
                    className="border-secondary-700 bg-secondary-900 absolute top-full right-0 z-50 mt-1 flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-3 overscroll-contain rounded-lg border p-3 shadow-2xl outline-none"
                >
                    <h2
                        id={titleId}
                        className="text-secondary-100 text-xs font-semibold tracking-wide"
                    >
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
