import 'server-only';
import { toProviderTurns, findSpecByApiModelId } from '../lib/utils';
import type { ProviderCallOptions } from '../model';
import type { DeepSeekUsageLike } from '../lib/usage';
import { CHAT_JOB_ID, extractDeepSeekUsage, logUsage } from '../lib/usage';
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
    apiKey,
    model,
    contents,
    systemInstruction,
    jobId = CHAT_JOB_ID,
}: ProviderCallOptions): Promise<string> {
    const spec = findSpecByApiModelId(model);
    if (!spec) {
        throw new Error(`Unknown model: ${model}`);
    }
    if (spec.provider !== 'deepseek') {
        throw new Error(`[deepseek] Non-DeepSeek model spec: ${model}`);
    }

    const startedAt = Date.now();
    const client = new OpenAI({
        apiKey,
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
    //
    // `stream_options.include_usage` makes DeepSeek append a final chunk that
    // carries `usage` and an empty `choices` array, so usage is only readable
    // by watching every chunk — there is no aggregated response object here.
    // The SDK's `CompletionUsage` type has no `prompt_cache_hit_tokens`, which
    // DeepSeek adds on top of the OpenAI-compatible shape; the cast narrows to
    // the superset our extractor understands.
    let text = '';
    let usage: DeepSeekUsageLike | undefined;
    for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
            text += delta;
        }
        if (chunk.usage) {
            usage = chunk.usage as DeepSeekUsageLike;
        }
    }

    logUsage({
        jobId,
        model,
        latencyMs: Date.now() - startedAt,
        ...extractDeepSeekUsage(usage),
    });

    if (text === '') {
        console.warn('[deepseek] Provider returned empty string');
    }
    return text;
}
