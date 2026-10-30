import 'server-only';
import OpenAI from 'openai';
import { resolveReasoningConfig } from '@y0ngha/siglens-core';
import {
    findSpecByApiModelId,
    resolveMaxOutputTokens,
    toProviderTurns,
    toSdkTransportOptions,
} from '../lib/utils';
import type { ProviderCallOptions } from '../model';
import {
    CHAT_JOB_ID,
    extractOpenAiCompatibleUsage,
    type OpenAiCompatibleUsageLike,
} from '../lib/usage';
import {
    createCallDeadline,
    runWithCallDeadline,
    toDeadlineRequestOptions,
} from './callDeadline';
import { logUsage } from './logUsage';

/**
 * DeepSeek의 추론 토글. `openai` SDK의 chat completion 파라미터에는 없는 비표준 필드다 —
 * DeepSeek은 OpenAI 호환 엔드포인트를 재사용하되, 요청마다 추론("thinking")을 켜고 끄는
 * 최상위 필드를 더한다.
 */
interface DeepSeekThinkingToggle {
    type: 'enabled' | 'disabled';
    reasoning_effort?: 'high';
}

/**
 * DeepSeek의 `thinking` 필드를 더한 스트리밍 `chat.completions.create` 파라미터.
 * `openai` SDK 타입이 모르는 필드를 코드베이스 나머지가 신경 쓰지 않도록 이 파일에 가둔다.
 *
 * 스트리밍이 필수다: DeepSeek은 긴 비스트리밍 연결을 ~50-60초에 끊는다(장황한 챗 답변이
 * 393216 max_tokens 상한에서 걸릴 수 있다). 스트리밍은 토큰이 흐르는 동안 연결을 유지하며,
 * 호출자 계약은 그대로 완전히 합친 텍스트를 돌려준다.
 */
type DeepSeekChatCompletionParams =
    OpenAI.Chat.ChatCompletionCreateParamsStreaming & {
        thinking: DeepSeekThinkingToggle;
    };

/** 스트림 전체를 읽어 합친 텍스트와 마지막으로 보고된 usage·종료 사유. */
interface AggregatedCompletion {
    text: string;
    usage: OpenAiCompatibleUsageLike | undefined;
    finishReason: string | null | undefined;
}

/**
 * 스트리밍된 delta를 하나의 대화 텍스트로 합친다.
 *
 * `stream_options.include_usage`는 DeepSeek이 `usage`와 빈 `choices`를 담은 마지막 chunk를
 * 덧붙이게 하므로, usage는 모든 chunk를 지켜봐야만 읽힌다 — 합쳐진 응답 객체가 없다.
 * SDK의 `CompletionUsage` 타입에는 DeepSeek이 OpenAI 호환 모양에 더하는
 * `prompt_cache_hit_tokens`가 없지만, 추출기가 받는 상위 집합 타입에 구조적으로 대입된다.
 */
async function aggregateCompletion(
    stream: AsyncIterable<OpenAI.Chat.ChatCompletionChunk>
): Promise<AggregatedCompletion> {
    const result: AggregatedCompletion = {
        text: '',
        usage: undefined,
        finishReason: undefined,
    };
    for await (const chunk of stream) {
        const choice = chunk.choices[0];
        const delta = choice?.delta?.content;
        if (delta) {
            result.text += delta;
        }
        if (choice?.finish_reason) {
            result.finishReason = choice.finish_reason;
        }
        if (chunk.usage) {
            result.usage = chunk.usage;
        }
    }
    return result;
}

/**
 * DeepSeek(OpenAI 호환 엔드포인트)으로 챗 한 번을 부르고 합친 텍스트를 돌려준다.
 * 마감(`limits.timeoutMs`)은 요청 생성부터 스트림 끝까지 한 번에 묶는다. 출력이
 * `max_tokens`에서 잘려도 부분 응답을 그대로 돌려주고 경고 로그만 남긴다.
 */
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
        ...toProviderTurns(contents),
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
        // 챗은 자연스러운 대화 텍스트(기본 `text` 모드)를 돌려준다 — 형제 openai/gemini 챗
        // 어댑터도 JSON을 강제하지 않는다. 여기서 `json_object`를 강제하면 챗봇이 산문 대신
        // JSON을 내보낸다.
        max_tokens: resolveMaxOutputTokens(spec.maxOutputTokens, limits),
        thinking,
        // temperature는 non-thinking 모드에서만 적용된다.
        ...(!useThinking ? { temperature: spec.temperature } : {}),
        stream: true,
        stream_options: { include_usage: true },
    };

    // 스트림 본문 읽기까지 `limits.timeoutMs`로 묶는다 — SDK timeout은 헤더 도착까지만 잰다.
    const deadline = createCallDeadline(limits?.timeoutMs);
    const { text, usage, finishReason } = await runWithCallDeadline(
        deadline,
        async () =>
            aggregateCompletion(
                await client.chat.completions.create(
                    params,
                    toDeadlineRequestOptions(deadline)
                )
            )
    );

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
