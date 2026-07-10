import { toProviderTurns, findSpecByApiModelId } from '../lib/utils';
import type { CallAiProviderOptions } from '@y0ngha/siglens-core';
import OpenAI from 'openai';

/**
 * DeepSeek's reasoning toggle. Non-standard for the `openai` SDK's chat
 * completion params — DeepSeek reuses the OpenAI-compatible endpoint but adds
 * this top-level field to switch reasoning ("thinking") on/off per request.
 */
interface DeepSeekThinkingToggle {
    type: 'enabled' | 'disabled';
    reasoning_effort?: 'high';
}

/**
 * Streaming `chat.completions.create` params extended with DeepSeek's `thinking`
 * field. Localized to this file so the rest of the codebase never has to reason
 * about a field the `openai` SDK types don't know about.
 *
 * Streaming is required: DeepSeek terminates long non-streaming connections at
 * ~50-60s (a verbose chatbot answer could hit this with the 393216 max_tokens
 * cap). Streaming keeps the connection alive as tokens flow; we still return the
 * fully-aggregated text, so the caller contract is unchanged.
 */
type DeepSeekChatCompletionParams =
    OpenAI.Chat.ChatCompletionCreateParamsStreaming & {
        thinking: DeepSeekThinkingToggle;
    };

export async function callDeepseekChat({
    serverApiKey,
    model,
    contents,
    systemInstruction,
}: CallAiProviderOptions): Promise<string> {
    const spec = findSpecByApiModelId(model);
    if (!spec) {
        throw new Error(`Unknown model: ${model}`);
    }
    if (spec.provider !== 'deepseek') {
        throw new Error(`[deepseek] Non-DeepSeek model spec: ${model}`);
    }

    const client = new OpenAI({
        apiKey: serverApiKey,
        baseURL: 'https://api.deepseek.com',
    });

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        ...(systemInstruction !== undefined
            ? [{ role: 'system' as const, content: systemInstruction }]
            : []),
        ...(toProviderTurns(
            contents
        ) as OpenAI.Chat.ChatCompletionMessageParam[]),
    ];

    const thinking: DeepSeekThinkingToggle = spec.thinking
        ? { type: 'enabled', reasoning_effort: 'high' }
        : { type: 'disabled' };

    const params: DeepSeekChatCompletionParams = {
        model,
        messages,
        // Chat returns natural conversational text (default `text` mode) — the
        // sibling openai/gemini chat adapters do NOT force JSON. Forcing
        // `json_object` here would make the chatbot emit JSON instead of prose.
        max_tokens: spec.maxOutputTokens,
        thinking,
        // temperature only applies in non-thinking mode.
        ...(!spec.thinking ? { temperature: spec.temperature } : {}),
        stream: true,
        stream_options: { include_usage: true },
    };

    const stream = await client.chat.completions.create(params);

    // Aggregate the streamed deltas into the full conversational text.
    let text = '';
    for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
            text += delta;
        }
    }

    if (text === '') {
        console.warn('[deepseek] Provider returned empty string');
    }
    return text;
}
