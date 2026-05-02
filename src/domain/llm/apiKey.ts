import type { LlmProvider } from '@y0ngha/siglens-core';
import { LLM_PROVIDER_VALUES } from '@/domain/llm/constants';

/** Trim a raw LLM API key string; returns `null` when the trimmed value is empty so callers can treat missing and blank uniformly. */
export function normalizeLlmApiKey(apiKey: string): string | null {
    const trimmed = apiKey.trim();
    return trimmed.length === 0 ? null : trimmed;
}

/** Type guard checking whether a string is a supported {@link LlmProvider}. */
export function isLlmProvider(value: string): value is LlmProvider {
    // TS limitation: ReadonlyArray<LlmProvider>.includes() does not accept `string`;
    // widening to readonly string[] is safe because LLM_PROVIDER_VALUES is always string[].
    return (LLM_PROVIDER_VALUES as readonly string[]).includes(value);
}
