import 'server-only';
import type {
    AgentProviderResult,
    CallAgentProvider,
    CallAgentProviderOptions,
    ModelId,
} from '@y0ngha/siglens-core';
import { MODEL_SPECS, getProviderForModel } from '@y0ngha/siglens-core';
import { getServerPrimaryKey } from '../../lib/serverKeys';
import { callDeepseekAgent } from './deepseek';

/**
 * Pilot (spec R12): the agent model is fixed server-side; client/core-supplied `model` is ignored.
 *
 * A literal, not core's `DEEPSEEK_V4_1_FLASH_MODEL`: this module is reachable from the
 * `@/entities/llm-provider` barrel, and many existing tests mock `@y0ngha/siglens-core`
 * with a partial factory — reading a core value at module load throws there. The router
 * test pins this literal to the core constant so they cannot drift.
 */
export const AGENT_MODEL = 'deepseek-v4.1-flash' satisfies ModelId;

/**
 * Per-turn provider bound to `AGENT_MODEL`. P3 reintroduces model choice, BYOK
 * keys and the Anthropic fallback; until then a DeepSeek outage surfaces as
 * `server_busy`/`server_error` to the user and the kill switch/alarms apply.
 */
export function createAgentProvider(): CallAgentProvider {
    return async (
        o: CallAgentProviderOptions
    ): Promise<AgentProviderResult> => {
        const apiKey = getServerPrimaryKey(getProviderForModel(AGENT_MODEL));
        if (apiKey === undefined)
            throw new Error(
                `[agent-router] No API key for model: ${AGENT_MODEL}`
            );
        return callDeepseekAgent({
            ...o,
            model: AGENT_MODEL,
            apiKey,
            apiModelId: MODEL_SPECS[AGENT_MODEL].apiModelId,
        });
    };
}
