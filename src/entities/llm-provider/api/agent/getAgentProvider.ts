import 'server-only';
import type { CallAgentProvider } from '@y0ngha/siglens-core';
import { isE2E } from '@/shared/api/e2eEnv';
import { fakeAgentProvider } from './fake';
import { createAgentProvider, type AgentProviderState } from './router';

/**
 * E2E면 fake, 아니면 모델이 고정된 DeepSeek provider(실패 시 Gemini 폴백).
 *
 * `AGENT_REAL_PROVIDER=1`은 `E2E_TEST=1`이 켜진 채로 실제 provider로 되돌린다. `E2E_TEST`가
 * 로컬 postgres 드라이버(`shared/db/client.ts`)도 고르기 때문에 이 탈출구가 필요하다: 없으면
 * dev 서버를 로컬 DB에 붙일 때 fake 모델까지 강제돼, 실제 DeepSeek 왕복을 운영 DB로만 시험할 수 있다.
 * CI는 이 값을 켜지 않으므로 e2e 스위트는 결정적인 fake를 유지한다.
 */
export function getAgentProvider(
    state?: AgentProviderState
): CallAgentProvider {
    const fake = isE2E() && process.env.AGENT_REAL_PROVIDER !== '1';
    return fake ? fakeAgentProvider : createAgentProvider(state);
}
