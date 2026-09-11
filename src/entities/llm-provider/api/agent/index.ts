import 'server-only';
import type { CallAgentProvider } from '@y0ngha/siglens-core';
import { isE2E } from '@/shared/api/e2eEnv';
import { fakeAgentProvider } from './fake';
import { createAgentProvider } from './router';

export { AGENT_MODEL } from './router';

/** E2E → fake; otherwise the fixed-model DeepSeek provider (same switch as `getLlmProvider`). */
export function getAgentProvider(): CallAgentProvider {
    return isE2E() ? fakeAgentProvider : createAgentProvider();
}
