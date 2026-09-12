import 'server-only';
import type { CallAgentProvider } from '@y0ngha/siglens-core';
import { isE2E } from '@/shared/api/e2eEnv';
import { fakeAgentProvider } from './fake';
import { createAgentProvider } from './router';

export { AGENT_MODEL } from './router';

/**
 * E2E → fake; otherwise the fixed-model DeepSeek provider.
 *
 * `AGENT_REAL_PROVIDER=1` opts back into the real provider while `E2E_TEST=1` is
 * still set. That combination exists because `E2E_TEST` also selects the local
 * postgres driver (`shared/db/client.ts`): without this escape hatch, pointing a
 * dev server at the local database forced the fake model too, so a real DeepSeek
 * round-trip could only be exercised against the production database. CI never
 * sets it, so the e2e suite keeps the deterministic fake.
 */
export function getAgentProvider(): CallAgentProvider {
    const fake = isE2E() && process.env.AGENT_REAL_PROVIDER !== '1';
    return fake ? fakeAgentProvider : createAgentProvider();
}
