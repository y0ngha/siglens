import 'server-only';
import OpenAI from 'openai';
import type {
    AgentProviderResult,
    AgentStopReason,
    AgentToolCall,
    CallAgentProviderOptions,
} from '@y0ngha/siglens-core';
import {
    extractOpenAiCompatibleUsage,
    logUsage,
    type OpenAiCompatibleUsageLike,
} from '../../lib/usage';

export const AGENT_JOB_ID = 'agent';

/** `CallAgentProviderOptions` plus the provider-specific model id the router resolved. */
export type AgentAdapterOptions = CallAgentProviderOptions & {
    apiModelId: string;
};

/**
 * No response headers / no chunk for this long aborts the call. A silent
 * provider otherwise holds the turn until the 10-minute stream deadline, and a
 * hung call cannot fall back to another model. 90s is well above the slowest
 * observed first-token latency on the flash tier.
 */
export const AGENT_STALL_TIMEOUT_MS = 90_000;
export const AGENT_PROVIDER_STALLED = 'AGENT_PROVIDER_STALLED';

/**
 * While tools are offered, the first this-many characters of a step's text are
 * held back instead of streamed. DeepSeek sometimes announces its tool calls
 * ("I'll check SIGLENS's latest analysis…", 2026-09-15 production) despite the
 * prompt forbidding it; a held announcement is dropped once a tool call
 * arrives. A real answer outgrows the hold within a second and streams on.
 * Announcements observed were under 100 characters.
 */
export const AGENT_NARRATION_HOLD_CHARS = 200;

/** Provider-specific bits of an OpenAI-compatible chat.completions request. */
export interface OpenAiCompatibleRequest {
    baseURL: string;
    /** Transcript without the system prompt (the loop prepends `o.system`). */
    messages: OpenAI.Chat.ChatCompletionMessageParam[];
    /** Provider-only top-level body fields (e.g. DeepSeek `thinking`). */
    extraBody: Record<string, unknown>;
}

/**
 * `finish_reason` alone is not enough: Gemini's OpenAI-compatible endpoint
 * reports `'stop'` even when the turn ended in tool calls (verified live
 * 2026-09-15). Mapping that to `end` would make core never run the tools.
 */
function mapStopReason(
    reason: string | null | undefined,
    hasToolCalls: boolean
): AgentStopReason {
    switch (reason) {
        case 'tool_calls':
            return 'tool_use';
        case 'stop':
            return hasToolCalls ? 'tool_use' : 'end';
        case 'length':
            return 'max_tokens';
        default:
            return 'other';
    }
}

function parseArgs(raw: string): Record<string, unknown> {
    try {
        const parsed: unknown = JSON.parse(raw || '{}');
        return typeof parsed === 'object' && parsed !== null
            ? (parsed as Record<string, unknown>)
            : {};
    } catch {
        return {};
    }
}

function stalledError(): Error {
    return Object.assign(
        new Error(
            `[agent] provider stalled: no response for ${AGENT_STALL_TIMEOUT_MS}ms`
        ),
        { code: AGENT_PROVIDER_STALLED }
    );
}

/**
 * The shared OpenAI-compatible streaming loop (DeepSeek, Gemini): request,
 * tool-call accumulation, stop mapping, usage telemetry and the stall watchdog.
 *
 * The watchdog aborts through an internal controller linked to `o.signal`, so
 * a stall rejects with `code: AGENT_PROVIDER_STALLED` while a caller abort
 * still surfaces as the plain abort error.
 */
export async function streamOpenAiCompatibleAgent(
    o: AgentAdapterOptions,
    req: OpenAiCompatibleRequest
): Promise<AgentProviderResult> {
    const client = new OpenAI({ apiKey: o.apiKey, baseURL: req.baseURL });
    const controller = new AbortController();
    const forwardAbort = (): void => controller.abort(o.signal.reason);
    if (o.signal.aborted) forwardAbort();
    else o.signal.addEventListener('abort', forwardAbort, { once: true });
    let stalled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = (): void => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            stalled = true;
            controller.abort();
        }, AGENT_STALL_TIMEOUT_MS);
    };

    const startedAt = Date.now();
    let text = '';
    // Held text not yet emitted; `null` once the hold is released for this step.
    let held: string | null = o.tools.length > 0 ? '' : null;
    const emitText = (delta: string): void => {
        text += delta;
        o.onEvent({ type: 'text', delta });
    };
    let finish: string | null | undefined;
    let usage: OpenAiCompatibleUsageLike | undefined;
    const partial = new Map<
        number,
        { id: string; name: string; args: string }
    >();
    try {
        arm();
        const stream = await client.chat.completions.create(
            {
                model: o.apiModelId,
                messages: [
                    { role: 'system', content: o.system },
                    ...req.messages,
                ],
                ...(o.tools.length > 0
                    ? {
                          tools: o.tools.map(t => ({
                              type: 'function' as const,
                              // `JsonSchemaObject` (core) is a closed shape with no index signature;
                              // the openai SDK's `FunctionParameters` requires `Record<string, unknown>`.
                              function: {
                                  name: t.name,
                                  description: t.description,
                                  parameters:
                                      t.inputSchema as unknown as Record<
                                          string,
                                          unknown
                                      >,
                              },
                          })),
                          tool_choice: o.toolChoice ?? 'auto',
                      }
                    : {}),
                max_tokens: o.maxOutputTokens,
                temperature: 0,
                ...req.extraBody,
                stream: true,
                stream_options: { include_usage: true },
            },
            { signal: controller.signal }
        );
        for await (const chunk of stream) {
            arm();
            const choice = chunk.choices[0];
            const delta = choice?.delta;
            if (delta?.content) {
                if (held === null) {
                    emitText(delta.content);
                } else {
                    held += delta.content;
                    if (held.length >= AGENT_NARRATION_HOLD_CHARS) {
                        emitText(held);
                        held = null;
                    }
                }
            }
            // Text held before a tool call is an announcement, not an answer.
            if (held !== null && delta?.tool_calls?.length) held = '';
            for (const tc of delta?.tool_calls ?? []) {
                const slot = partial.get(tc.index) ?? {
                    id: '',
                    name: '',
                    args: '',
                };
                if (tc.id) slot.id = tc.id;
                // Name arrives whole (openai SDK's own accumulator assigns it); only arguments stream in pieces.
                if (tc.function?.name) slot.name = tc.function.name;
                if (tc.function?.arguments) slot.args += tc.function.arguments;
                partial.set(tc.index, slot);
            }
            if (choice?.finish_reason) finish = choice.finish_reason;
            if (chunk.usage) usage = chunk.usage as OpenAiCompatibleUsageLike;
        }
        // The openai SDK ends `for await` quietly when the signal aborts mid-stream; the
        // port contract says upstream errors propagate, so don't resolve a partial result.
        o.signal.throwIfAborted();
        if (stalled) throw stalledError();
    } catch (err) {
        if (stalled && !o.signal.aborted) throw stalledError();
        throw err;
    } finally {
        clearTimeout(timer);
        o.signal.removeEventListener('abort', forwardAbort);
    }

    const toolCalls: AgentToolCall[] = [...partial.entries()]
        .sort(([a], [b]) => a - b)
        // An id-less call would replay as `tool_call_id: ''` next step and collide in the UI.
        .map(([index, s]) => ({
            id: s.id || `call_${index}`,
            name: s.name,
            args: parseArgs(s.args),
        }));
    const stopReason = mapStopReason(finish, toolCalls.length > 0);
    if (held && stopReason !== 'tool_use') emitText(held);
    // Core only executes calls on `tool_use`; announcing others would show chips for calls that never run.
    if (stopReason === 'tool_use') {
        for (const call of toolCalls) o.onEvent({ type: 'tool_call', call });
    }

    const normalized = extractOpenAiCompatibleUsage(usage);
    logUsage({
        jobId: AGENT_JOB_ID,
        model: o.apiModelId,
        latencyMs: Date.now() - startedAt,
        ...normalized,
    });
    o.onEvent({ type: 'usage', usage: normalized });

    o.onEvent({ type: 'stop', reason: stopReason });

    return { text, toolCalls, stopReason, usage: normalized };
}
