import 'server-only';
import { resolveReasoningConfig } from '@y0ngha/siglens-core';
import {
    toProviderTurns,
    findSpecByApiModelId,
    resolveMaxOutputTokens,
    toSdkTransportOptions,
    createCallDeadline,
} from '../lib/utils';
import type { ProviderCallOptions } from '../model';
import type { OpenAiCompatibleUsageLike } from '../lib/usage';
import {
    CHAT_JOB_ID,
    extractOpenAiCompatibleUsage,
    logUsage,
} from '../lib/usage';
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
    limits,
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
        ...toSdkTransportOptions(limits),
    });

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        ...(systemInstruction !== undefined
            ? [{ role: 'system' as const, content: systemInstruction }]
            : []),
        ...(toProviderTurns(
            contents
        ) as OpenAI.Chat.ChatCompletionMessageParam[]),
    ];

    // 챗은 추론 토글이 없다 — 스펙의 기본 상태를 따른다(Free·Member는 기본 OFF).
    const useThinking = resolveReasoningConfig(
        spec.reasoning,
        undefined
    ).thinking;
    const thinking: DeepSeekThinkingToggle = useThinking
        ? { type: 'enabled', reasoning_effort: 'high' }
        : { type: 'disabled' };

    const params: DeepSeekChatCompletionParams = {
        model,
        messages,
        // Chat returns natural conversational text (default `text` mode) — the
        // sibling openai/gemini chat adapters do NOT force JSON. Forcing
        // `json_object` here would make the chatbot emit JSON instead of prose.
        max_tokens: resolveMaxOutputTokens(spec.maxOutputTokens, limits),
        thinking,
        // temperature only applies in non-thinking mode.
        ...(!useThinking ? { temperature: spec.temperature } : {}),
        stream: true,
        stream_options: { include_usage: true },
    };

    // 스트림 본문 읽기까지 `limits.timeoutMs`로 묶는다 — SDK timeout은 헤더 도착까지만 잰다.
    const deadline = createCallDeadline(limits?.timeoutMs);
    let text = '';
    let usage: OpenAiCompatibleUsageLike | undefined;
    let finishReason: string | null | undefined;
    const consume = async (): Promise<void> => {
        const stream = await client.chat.completions.create(
            params,
            deadline.signal !== undefined
                ? { signal: deadline.signal }
                : undefined
        );

        // Aggregate the streamed deltas into the full conversational text.
        //
        // `stream_options.include_usage` makes DeepSeek append a final chunk that
        // carries `usage` and an empty `choices` array, so usage is only readable
        // by watching every chunk — there is no aggregated response object here.
        // The SDK's `CompletionUsage` type has no `prompt_cache_hit_tokens`, which
        // DeepSeek adds on top of the OpenAI-compatible shape; the cast narrows to
        // the superset our extractor understands.
        for await (const chunk of stream) {
            const choice = chunk.choices[0];
            const delta = choice?.delta?.content;
            if (delta) {
                text += delta;
            }
            if (choice?.finish_reason) {
                finishReason = choice.finish_reason;
            }
            if (chunk.usage) {
                usage = chunk.usage as OpenAiCompatibleUsageLike;
            }
        }
    };
    try {
        await deadline.guard(consume());
    } finally {
        deadline.dispose();
    }

    logUsage({
        jobId,
        model,
        latencyMs: Date.now() - startedAt,
        ...extractOpenAiCompatibleUsage(usage),
    });

    if (text === '') {
        console.warn('[deepseek] Provider returned empty string');
    }
    // 잘린 글도 그대로 돌려준다 — 호출자(챗·번역·평이화)마다 부분 응답의 가치가 달라
    // 여기서 일괄로 실패시키지 않는다. 대신 로그로 남겨, 출력 상한이 실제 산출물보다
    // 낮게 잡혀 있는지를 운영 로그에서 셀 수 있게 한다(2026-10-07 평이화 절단 사례).
    if (finishReason === 'length') {
        console.warn('[deepseek] Output truncated at max_tokens', {
            jobId,
            model,
            maxTokens: params.max_tokens,
            chars: text.length,
        });
    }
    return text;
}
