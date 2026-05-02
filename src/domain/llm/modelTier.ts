import { TIER_CONFIG } from '@y0ngha/siglens-core';
import type { ModelId } from '@y0ngha/siglens-core';
import type { LlmProvider } from '@/domain/llm/constants';

/** Provider map: which LLM provider backs each model family. */
const MODEL_PROVIDER_MAP: Partial<Record<ModelId, LlmProvider>> = {
    'claude-haiku-3-5': 'anthropic',
    'claude-sonnet-4-6': 'anthropic',
    'claude-opus-4-7': 'anthropic',
    'gpt-5-mini': 'openai',
    'gpt-5.4': 'openai',
    'gpt-5.5': 'openai',
    'gemini-2.5-flash': 'google',
    'gemini-2.5-flash-lite': 'google',
    'gemini-2.5-pro': 'google',
    'gemini-3-flash-preview': 'google',
    'gemini-3.1-pro-preview': 'google',
};

/** The set of free-tier model ids for fast lookup. */
const FREE_MODEL_SET = new Set<ModelId>(TIER_CONFIG.models.free);

/**
 * Returns `true` when `model` is available on the free tier without a
 * user-supplied API key.
 */
export function isFreeChatModel(model: ModelId): boolean {
    return FREE_MODEL_SET.has(model);
}

/**
 * Returns the {@link LlmProvider} whose API key is required to use `model`.
 * Falls back to `'google'` for unknown model ids so callers always get a value.
 */
export function getRequiredProviderForModel(model: ModelId): LlmProvider {
    return MODEL_PROVIDER_MAP[model] ?? 'google';
}
