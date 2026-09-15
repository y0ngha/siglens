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
import { callGeminiAgent } from './gemini';
import { AGENT_PROVIDER_STALLED } from './openAiCompatibleStream';

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
 * Automatic fallback for the agent (ai.siglens.io has no model picker, so the
 * user cannot switch models themselves). Same literal-not-core-value rule as
 * `AGENT_MODEL`; the router test pins it to core's spec table.
 */
export const AGENT_FALLBACK_MODEL = 'gemini-3.6-flash' satisfies ModelId;

/**
 * Out-of-band signal for whether a turn actually ran on `AGENT_FALLBACK_MODEL`.
 * `CallAgentProvider` (core's type) only returns per-step results, not which
 * model produced them, so the caller cannot otherwise tell — this lets
 * route.ts persist/log the model that really answered instead of always
 * `AGENT_MODEL`. The caller creates one instance per turn and passes the same
 * object across every step; `createAgentProvider` flips it at most once, on
 * the step where DeepSeek failed and Gemini took over.
 */
export interface AgentProviderState {
    fallbackUsed: boolean;
}

/**
 * Provider trouble is worth one attempt on another vendor: 429, 5xx, errors
 * with no HTTP status (network) and the stall watchdog. Any other 4xx is a
 * malformed request the second vendor would reject too.
 */
function isFallbackEligible(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return true;
    if ((error as { code?: unknown }).code === AGENT_PROVIDER_STALLED)
        return true;
    const status = (error as { status?: unknown }).status;
    if (typeof status !== 'number') return true;
    return status === 429 || status >= 500;
}

/**
 * Per-turn provider bound to `AGENT_MODEL` (DeepSeek). When DeepSeek fails for
 * provider reasons before anything user-visible streamed, the same turn is
 * retried once on `AGENT_FALLBACK_MODEL` (Gemini) with the server key.
 *
 * No fallback when: the caller aborted; a `text`/`tool_call` event was already
 * forwarded (a retry would duplicate output); the error is a non-429 4xx; or
 * no Gemini server key is configured. Those rethrow the DeepSeek error, which
 * surfaces as `server_busy`/`server_error`. P3 reintroduces model choice and
 * BYOK keys.
 */
export function createAgentProvider(
    state?: AgentProviderState
): CallAgentProvider {
    return async (
        o: CallAgentProviderOptions
    ): Promise<AgentProviderResult> => {
        const apiKey = getServerPrimaryKey(getProviderForModel(AGENT_MODEL));
        if (apiKey === undefined)
            throw new Error(
                `[agent-router] No API key for model: ${AGENT_MODEL}`
            );
        let emitted = false;
        try {
            return await callDeepseekAgent({
                ...o,
                onEvent: e => {
                    if (e.type === 'text' || e.type === 'tool_call')
                        emitted = true;
                    o.onEvent(e);
                },
                model: AGENT_MODEL,
                apiKey,
                apiModelId: MODEL_SPECS[AGENT_MODEL].apiModelId,
            });
        } catch (err) {
            const fallbackKey = getServerPrimaryKey(
                getProviderForModel(AGENT_FALLBACK_MODEL)
            );
            if (
                o.signal.aborted ||
                emitted ||
                !isFallbackEligible(err) ||
                !fallbackKey
            )
                throw err;
            console.warn(
                JSON.stringify({
                    tag: '[agent-router] deepseek failed, falling back',
                    fallbackModel: AGENT_FALLBACK_MODEL,
                    message: err instanceof Error ? err.message : String(err),
                })
            );
            if (state) state.fallbackUsed = true;
            return callGeminiAgent({
                ...o,
                model: AGENT_FALLBACK_MODEL,
                apiKey: fallbackKey,
                apiModelId: MODEL_SPECS[AGENT_FALLBACK_MODEL].apiModelId,
            });
        }
    };
}
