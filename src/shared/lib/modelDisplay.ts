import type { ModelId } from '@y0ngha/siglens-core';

/**
 * Human-readable label + full name for an AI model, shown in model-selector
 * UI (analysis model dropdown, chat model dropdown). Extracted to `shared`
 * because `widgets/analysis` (ModelSelector) and `widgets/chat` (ChatPanel)
 * previously duplicated an identical map — cross-widget imports are allowed by
 * FSD here, but a shared, presentation-only lookup table belongs in `shared`
 * rather than being owned by either widget.
 */
export interface ModelDisplayInfo {
    label: string;
    fullName: string;
}

export const MODEL_DISPLAY_MAP: Partial<Record<ModelId, ModelDisplayInfo>> = {
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
    'claude-haiku-4-5': { label: 'Haiku', fullName: 'Claude Haiku 4.5' },
    'claude-sonnet-4-6': { label: 'Sonnet', fullName: 'Claude Sonnet 4.6' },
    'claude-opus-4-7': { label: 'Opus', fullName: 'Claude Opus 4.7' },
    'gpt-5-mini': { label: 'GPT Mini', fullName: 'GPT-5 Mini' },
    'gpt-5.4': { label: 'GPT 5.4', fullName: 'GPT-5.4' },
    'gpt-5.5': { label: 'GPT 5.5', fullName: 'GPT-5.5' },
    'deepseek-v4-flash': {
        label: 'DeepSeek Flash',
        fullName: 'DeepSeek V4 Flash',
    },
    'deepseek-v4-pro': { label: 'DeepSeek Pro', fullName: 'DeepSeek V4 Pro' },
};

/** Falls back to the raw model id (for both label and fullName) when unmapped. */
export function getModelDisplay(id: ModelId): ModelDisplayInfo {
    return MODEL_DISPLAY_MAP[id] ?? { label: id, fullName: id };
}
