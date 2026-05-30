import type { CallAiProvider } from '@y0ngha/siglens-core';
// Slice-internal relative import (NOT the '@/entities/llm-provider' barrel):
// the barrel re-exports getLlmProvider, so importing the router through it would
// create a circular dependency (barrel → getLlmProvider → barrel).
import { callAiProviderRouter } from './router';
import { fakeCallAiProvider } from './FakeChatProvider';

/**
 * Returns the chat AI provider: the deterministic fake under E2E_TEST, else the
 * real `callAiProviderRouter` (provider-routing SDK adapter).
 *
 * The fake reads no env vars / API keys and is tiny, so it stays a normal
 * top-level import (no require-gating needed) — letting chat work in E2E
 * without real LLM keys while leaving the prod path unchanged.
 *
 * DELIBERATE: unlike the other E2E fakes (FakeMarketProvider / FakeNewsClient /
 * FakeOptionsDataProvider / FakeFundamentalDataProvider), which are require-gated
 * to keep them out of the prod bundle, FakeChatProvider is intentionally a static
 * import because (a) it has no heavy deps (no postgres / JSON fixtures), so its
 * bundle footprint is negligible, and (b) the static import keeps this function's
 * E2E branch unit-testable — getLlmProvider.test.ts can mock the static module,
 * whereas vitest cannot mock a relative CJS `require` inside a require-gated
 * factory. Switching to require-gating would break that unit test.
 */
export function getLlmProvider(): CallAiProvider {
    if (process.env.E2E_TEST === '1') {
        return fakeCallAiProvider;
    }
    return callAiProviderRouter;
}
