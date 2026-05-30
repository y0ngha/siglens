import type { CallAiProvider } from '@y0ngha/siglens-core';
import { callAiProviderRouter } from '@/entities/llm-provider';
import { fakeCallAiProvider } from './FakeChatProvider';

/**
 * Returns the chat AI provider: the deterministic fake under E2E_TEST, else the
 * real `callAiProviderRouter` (provider-routing SDK adapter).
 *
 * The fake reads no env vars / API keys and is tiny, so it stays a normal
 * top-level import (no require-gating needed) — letting chat work in E2E
 * without real LLM keys while leaving the prod path unchanged.
 */
export function getLlmProvider(): CallAiProvider {
    if (process.env.E2E_TEST === '1') {
        return fakeCallAiProvider;
    }
    return callAiProviderRouter;
}
