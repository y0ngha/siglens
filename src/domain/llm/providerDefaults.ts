import {
    MODEL_SPECS,
    type AIProvider,
    type ModelId,
} from '@y0ngha/siglens-core';

/** Default model when no provider-specific resolved model is available. Centralized to avoid drift across consumers. */
export const FALLBACK_MODEL_ID = 'claude-haiku-4-5' as const satisfies ModelId;

export const CLAUDE_MODEL_PRIORITY: readonly ModelId[] = [
    'claude-opus-4-7',
    'claude-sonnet-4-6',
    'claude-haiku-4-5',
];

export const GEMINI_MODEL_PRIORITY: readonly ModelId[] = [
    'gemini-3.1-pro-preview',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
];

export const CHATGPT_MODEL_PRIORITY: readonly ModelId[] = [
    'gpt-5.5',
    'gpt-5.4',
    'gpt-5-mini',
];

const PROVIDER_PRIORITY_MAP: Record<AIProvider, readonly ModelId[]> = {
    claude: CLAUDE_MODEL_PRIORITY,
    gemini: GEMINI_MODEL_PRIORITY,
    chatgpt: CHATGPT_MODEL_PRIORITY,
};

export function resolveDefaultModelForProvider(
    provider: AIProvider,
    allowedModels: readonly ModelId[]
): ModelId | null {
    const priorityList = PROVIDER_PRIORITY_MAP[provider];
    const allowedSet = new Set(allowedModels);

    const match = priorityList.find(
        modelId =>
            allowedSet.has(modelId) &&
            modelId in MODEL_SPECS &&
            // PROVIDER_PRIORITY_MAP only contains keys defined in MODEL_SPECS, so the cast is safe
            MODEL_SPECS[modelId as keyof typeof MODEL_SPECS].provider ===
                provider
    );

    return match ?? null;
}
