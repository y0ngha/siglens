import 'server-only';
import OpenAI from 'openai';
import type {
    AgentProviderResult,
    AgentStopReason,
    AgentToolCall,
    CallAgentProviderOptions,
} from '@y0ngha/siglens-core';
import {
    extractDeepSeekUsage,
    logUsage,
    type DeepSeekUsageLike,
} from '../../lib/usage';
import { toOpenAiChatMessages } from './mapMessages';

export const AGENT_JOB_ID = 'agent';

/** `CallAgentProviderOptions` plus the provider-specific model id the router resolved. */
export type AgentAdapterOptions = CallAgentProviderOptions & {
    apiModelId: string;
};

function mapStopReason(reason: string | null | undefined): AgentStopReason {
    switch (reason) {
        case 'tool_calls':
            return 'tool_use';
        case 'stop':
            return 'end';
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

/** DeepSeek via the OpenAI-compatible chat.completions stream; thinking OFF (spec §2-6, pilot). */
export async function callDeepseekAgent(
    o: AgentAdapterOptions
): Promise<AgentProviderResult> {
    const client = new OpenAI({
        apiKey: o.apiKey,
        baseURL: 'https://api.deepseek.com',
    });
    const startedAt = Date.now();
    const stream = await client.chat.completions.create(
        {
            model: o.apiModelId,
            messages: [
                { role: 'system', content: o.system },
                ...toOpenAiChatMessages(o.messages),
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
                              parameters: t.inputSchema as unknown as Record<
                                  string,
                                  unknown
                              >,
                          },
                      })),
                      tool_choice: 'auto' as const,
                  }
                : {}),
            max_tokens: o.maxOutputTokens,
            temperature: 0,
            // DeepSeek-only top-level field, absent from the openai SDK types.
            ...({ thinking: { type: 'disabled' } } as Record<string, unknown>),
            stream: true,
            stream_options: { include_usage: true },
        },
        { signal: o.signal }
    );

    let text = '';
    let finish: string | null | undefined;
    let usage: DeepSeekUsageLike | undefined;
    const partial = new Map<
        number,
        { id: string; name: string; args: string }
    >();
    for await (const chunk of stream) {
        const choice = chunk.choices[0];
        const delta = choice?.delta;
        if (delta?.content) {
            text += delta.content;
            o.onEvent({ type: 'text', delta: delta.content });
        }
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
        if (chunk.usage) usage = chunk.usage as DeepSeekUsageLike;
    }
    // The openai SDK ends `for await` quietly when the signal aborts mid-stream; the
    // port contract says upstream errors propagate, so don't resolve a partial result.
    o.signal.throwIfAborted();

    const toolCalls: AgentToolCall[] = [...partial.entries()]
        .sort(([a], [b]) => a - b)
        // An id-less call would replay as `tool_call_id: ''` next step and collide in the UI.
        .map(([index, s]) => ({
            id: s.id || `call_${index}`,
            name: s.name,
            args: parseArgs(s.args),
        }));
    const stopReason = mapStopReason(finish);
    // Core only executes calls on `tool_use`; announcing others would show chips for calls that never run.
    if (stopReason === 'tool_use') {
        for (const call of toolCalls) o.onEvent({ type: 'tool_call', call });
    }

    const normalized = extractDeepSeekUsage(usage);
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
