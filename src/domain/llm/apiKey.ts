import type { LlmProvider } from '@y0ngha/siglens-core';
import { LLM_PROVIDER_VALUES } from './constants';

/**
 * Normalize a raw LLM API key string by trimming whitespace.
 *
 * Returns `null` when the input is empty after trimming, so callers can treat
 * "missing" and "blank" inputs uniformly without re-implementing whitespace
 * checks at every call site.
 *
 * @param apiKey - Raw API key value supplied by the user.
 * @returns The trimmed key, or `null` when the trimmed value is empty.
 */
export function normalizeLlmApiKey(apiKey: string): string | null {
    const trimmed = apiKey.trim();
    return trimmed.length === 0 ? null : trimmed;
}

/**
 * Type guard that checks whether a string is a supported {@link LlmProvider}.
 *
 * @param value - Arbitrary string to test.
 * @returns `true` when `value` is one of {@link LLM_PROVIDER_VALUES}.
 */
export function isLlmProvider(value: string): value is LlmProvider {
    // TS limitation: ReadonlyArray<LlmProvider>.includes() does not accept `string`;
    // widening to readonly string[] is safe because LLM_PROVIDER_VALUES is always string[].
    return (LLM_PROVIDER_VALUES as readonly string[]).includes(value);
}
