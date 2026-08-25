'use client';

import { useId, useRef } from 'react';
import { DEEPSEEK_V4_FLASH_MODEL, type ModelId } from '@y0ngha/siglens-core';
import { ReasoningToggle } from '@/features/reasoning-toggle';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { useIsMobileViewport } from '@/shared/hooks/useIsMobileViewport';
import { usePopoverToggle } from '@/shared/hooks/usePopoverToggle';
import { cn } from '@/shared/lib/cn';
import { getModelDisplay } from '@/shared/lib/modelDisplay';
import { GearIcon } from '@/shared/ui/GearIcon';
import { PopoverSurface } from '@/shared/ui/PopoverSurface';
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
    const isMobileViewport = useIsMobileViewport();

    // Mirrors PortfolioChipPopover: a focus trap owns initial focus, Tab
    // cycling, and restoring focus to the trigger on EVERY close path
    // (Escape, click-outside, re-toggle) via its unmount/deactivate cleanup,
    // so we don't hand-roll a partial (Escape-only) restore here.
    // `isMobileViewport`을 rearmKey로 넘긴다 — 뷰포트가 뒤집히면 PopoverSurface가
    // 인라인 렌더 ↔ 포털 사이를 오가며 패널 노드를 교체하는데, ref의 identity는
    // 그대로라 트랩이 새 노드에 다시 무장되지 않는다(기기 회전 시 포커스 유실).
    useFocusTrap(panelRef, isOpen, isMobileViewport);
    useEscapeKey(close, isOpen);

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
                        className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary-500"
                    />
                )}
            </button>

            {isOpen && (
                <PopoverSurface
                    isMobile={isMobileViewport}
                    dialogRef={panelRef}
                    titleId={titleId}
                    desktopClassName="mt-1"
                    className={cn(
                        'border-secondary-700 bg-secondary-900 flex flex-col gap-3',
                        'overscroll-contain rounded-lg border p-3 shadow-2xl outline-none'
                    )}
                >
                    <h2
                        id={titleId}
                        className="text-base font-semibold text-secondary-100"
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
                </PopoverSurface>
            )}
        </div>
    );
}
