'use client';

import { useRef, useCallback, useMemo } from 'react';
import type { AIProvider, ModelId } from '@y0ngha/siglens-core';
import { resolveDefaultModelForProvider } from '@/domain/llm/providerDefaults';
import { cn } from '@/lib/cn';

const PROVIDER_ORDER: readonly AIProvider[] = ['claude', 'gemini', 'chatgpt'];

const PROVIDER_DISPLAY_NAME: Record<AIProvider, string> = {
    claude: 'CLAUDE',
    gemini: 'GEMINI',
    chatgpt: 'CHATGPT',
};

interface ProviderConfig {
    provider: AIProvider;
    displayName: string;
}

const PROVIDER_CONFIG: readonly ProviderConfig[] = PROVIDER_ORDER.map(
    provider => ({
        provider,
        displayName: PROVIDER_DISPLAY_NAME[provider],
    })
);

interface ModelSelectorProps {
    selectedProvider: AIProvider;
    onProviderChange: (provider: AIProvider) => void;
    allowedModels: readonly ModelId[];
    disabled?: boolean;
}

export function ModelSelector({
    selectedProvider,
    onProviderChange,
    allowedModels,
    disabled = false,
}: ModelSelectorProps) {
    const groupRef = useRef<HTMLDivElement>(null);

    const resolvedModels = useMemo(
        () =>
            PROVIDER_CONFIG.map(({ provider, displayName }) => {
                const modelId = resolveDefaultModelForProvider(
                    provider,
                    allowedModels
                );
                return {
                    provider,
                    displayName,
                    modelId,
                    isLocked: modelId === null,
                };
            }),
        [allowedModels]
    );

    const handleSelect = useCallback(
        (provider: AIProvider, isLocked: boolean): void => {
            if (disabled || isLocked) return;
            onProviderChange(provider);
        },
        [disabled, onProviderChange]
    );

    const handleKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLDivElement>): void => {
            if (disabled) return;

            const nonLockedProviders = resolvedModels
                .filter(m => !m.isLocked)
                .map(m => m.provider);

            if (nonLockedProviders.length === 0) return;

            const currentIndex = nonLockedProviders.indexOf(selectedProvider);
            let nextProvider: AIProvider | undefined;

            switch (event.key) {
                case 'ArrowRight': {
                    event.preventDefault();
                    const nextIdx =
                        (currentIndex + 1) % nonLockedProviders.length;
                    nextProvider = nonLockedProviders[nextIdx];
                    break;
                }
                case 'ArrowLeft': {
                    event.preventDefault();
                    const prevIdx =
                        (currentIndex - 1 + nonLockedProviders.length) %
                        nonLockedProviders.length;
                    nextProvider = nonLockedProviders[prevIdx];
                    break;
                }
                case 'Home': {
                    event.preventDefault();
                    nextProvider = nonLockedProviders[0];
                    break;
                }
                case 'End': {
                    event.preventDefault();
                    nextProvider =
                        nonLockedProviders[nonLockedProviders.length - 1];
                    break;
                }
                case ' ':
                case 'Enter': {
                    event.preventDefault();
                    // Space/Enter selects the currently focused option
                    // (already selected, no-op needed — focus is handled via tabIndex)
                    return;
                }
                default:
                    return;
            }

            if (nextProvider !== undefined) {
                onProviderChange(nextProvider);
                // Sync DOM focus to the newly selected option
                const group = groupRef.current;
                if (group !== null) {
                    const button = group.querySelector<HTMLElement>(
                        `[data-provider="${nextProvider}"]`
                    );
                    button?.focus();
                }
            }
        },
        [disabled, resolvedModels, selectedProvider, onProviderChange]
    );

    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-secondary-500 text-xs font-medium tracking-[0.15em] uppercase">
                AI MODEL
            </span>
            <div
                ref={groupRef}
                role="radiogroup"
                aria-label="AI 분석 모델 선택"
                className="border-secondary-700 grid grid-cols-3 overflow-hidden rounded-md border"
                onKeyDown={handleKeyDown}
            >
                {resolvedModels.map(
                    ({ provider, displayName, modelId, isLocked }) => {
                        const isSelected = provider === selectedProvider;
                        const isEffectivelyDisabled = disabled || isLocked;

                        return (
                            <div
                                key={provider}
                                role="radio"
                                aria-checked={isSelected}
                                aria-disabled={isEffectivelyDisabled}
                                tabIndex={isSelected ? 0 : -1}
                                data-provider={provider}
                                title={isLocked ? 'Pro 등급 전용' : undefined}
                                onClick={() => handleSelect(provider, isLocked)}
                                onKeyDown={e => {
                                    if (
                                        (e.key === ' ' || e.key === 'Enter') &&
                                        !isEffectivelyDisabled
                                    ) {
                                        e.preventDefault();
                                        handleSelect(provider, isLocked);
                                    }
                                }}
                                className={cn(
                                    'relative flex cursor-pointer flex-col items-center gap-1 border-r px-2 py-2.5 transition-colors select-none last:border-r-0',
                                    'focus-visible:ring-primary-500 focus-visible:ring-1 focus-visible:outline-none',
                                    isSelected
                                        ? 'border-r-secondary-700 bg-primary-500/10'
                                        : 'border-r-secondary-700',
                                    isEffectivelyDisabled
                                        ? 'cursor-not-allowed opacity-60'
                                        : !isSelected &&
                                              'hover:bg-secondary-700/30'
                                )}
                            >
                                {isLocked && (
                                    <span
                                        className="text-secondary-500 absolute top-1 right-1"
                                        aria-hidden="true"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 16 16"
                                            fill="currentColor"
                                            className="h-2.5 w-2.5"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v4A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5v-4A1.5 1.5 0 0 0 11 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                    </span>
                                )}

                                <span aria-hidden="true">
                                    {isSelected ? (
                                        <span className="text-primary-300 text-sm">
                                            ◆
                                        </span>
                                    ) : (
                                        <span className="text-secondary-400 text-sm">
                                            ◇
                                        </span>
                                    )}
                                </span>

                                <span className="sr-only">
                                    {isSelected ? '선택됨' : '선택 안됨'}
                                    {isLocked ? ', Pro 등급 전용' : ''}
                                </span>

                                <span
                                    className={cn(
                                        'text-xs font-medium tracking-[0.15em] uppercase',
                                        isSelected
                                            ? 'text-primary-300'
                                            : 'text-secondary-400'
                                    )}
                                >
                                    {displayName}
                                </span>

                                <span className="text-secondary-500 font-mono text-[10px] tabular-nums">
                                    {modelId !== null
                                        ? formatModelVariant(modelId)
                                        : '—'}
                                </span>
                            </div>
                        );
                    }
                )}
            </div>
        </div>
    );
}

/**
 * Extracts a short display variant string from a ModelId.
 * e.g. "claude-sonnet-4-6" → "Sonnet 4.6"
 *      "gemini-2.5-pro"    → "2.5 Pro"
 *      "gpt-5.5"           → "5.5"
 */
function formatModelVariant(modelId: ModelId): string {
    // claude-* → extract after "claude-"
    const claudeMatch = /^claude-(.+)$/.exec(modelId);
    if (claudeMatch !== null) {
        return claudeMatch[1]
            .split('-')
            .map(part => {
                if (/^\d+$/.test(part)) return part;
                return part.charAt(0).toUpperCase() + part.slice(1);
            })
            .join(' ')
            .replace(/(\d) (\d)/g, '$1.$2');
    }

    // gemini-* → drop "gemini-" prefix
    const geminiMatch = /^gemini-(.+)$/.exec(modelId);
    if (geminiMatch !== null) {
        return geminiMatch[1]
            .split('-')
            .map(part => {
                if (/^\d/.test(part)) return part;
                return part.charAt(0).toUpperCase() + part.slice(1);
            })
            .join(' ');
    }

    // gpt-* → drop "gpt-" prefix
    const gptMatch = /^gpt-(.+)$/.exec(modelId);
    if (gptMatch !== null) {
        return gptMatch[1];
    }

    return modelId;
}
