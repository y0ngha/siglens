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
 * `chat.completions.create` params extended with DeepSeek's `thinking` field.
 * Localized to this file so the rest of the codebase never has to reason
 * about a field the `openai` SDK types don't know about.
 */
type DeepSeekChatCompletionParams =
    OpenAI.Chat.ChatCompletionCreateParamsNonStreaming & {
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
    };

    const response = await client.chat.completions.create(params);

    const text = response.choices[0]?.message.content;
    if (text === null || text === undefined) {
        throw new Error('[deepseek] Provider returned null/undefined response');
    }
    if (text === '') {
        console.warn('[deepseek] Provider returned empty string');
    }
    return text;
}
