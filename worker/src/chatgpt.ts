import OpenAI from 'openai';
import { AI_SYSTEM_PROMPT } from './ai-system-prompt.js';
import { CHATGPT_MODEL_MAX_TOKENS } from './models.js';
import type { ChatGPTModel } from './models.js';

const CHATGPT_TIMEOUT_MS = 3600_000;

const clientCache = new Map<string, OpenAI>();

function getClient(apiKey: string): OpenAI {
    let client = clientCache.get(apiKey);
    if (!client) {
        client = new OpenAI({ apiKey });
        clientCache.set(apiKey, client);
    }
    return client;
}

export interface ChatGPTCallOptions {
    /** 호출에 사용할 GPT 모델. */
    model: ChatGPTModel;
    /** 호출에 사용할 API key. user 키 또는 server 키. */
    apiKey: string;
    /** 외부에서 전달되는 abort signal. */
    signal?: AbortSignal;
}

export async function callChatGPT(
    prompt: string,
    options: ChatGPTCallOptions
): Promise<string> {
    const { model, apiKey } = options;
    const client = getClient(apiKey);
    const maxTokens = CHATGPT_MODEL_MAX_TOKENS[model];

    const controller = new AbortController();
    // .unref()로 timer가 event loop를 점유하지 않게 하여 정상 종료를 막지 않도록 한다.
    const timeoutId = setTimeout(
        () => controller.abort(),
        CHATGPT_TIMEOUT_MS
    ).unref();
    const propagateAbort = (): void => controller.abort();
    options.signal?.addEventListener('abort', propagateAbort, { once: true });

    const start = Date.now();
    try {
        const response = await client.chat.completions.create(
            {
                model,
                temperature: 0,
                top_p: 0.95,
                max_completion_tokens: maxTokens,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: AI_SYSTEM_PROMPT },
                    { role: 'user', content: prompt },
                ],
            },
            { signal: controller.signal }
        );

        const elapsed = Date.now() - start;
        const choice = response.choices[0];
        const finishReason = choice?.finish_reason;

        console.log(
            `[ChatGPT] Response time: ${elapsed}ms (model: ${model}, finish_reason: ${finishReason})`
        );

        if (finishReason === 'stop') {
            const text = choice.message.content;
            if (text) {
                return text;
            }
            console.warn('[ChatGPT] Empty text response', {
                model,
                finishReason,
            });
            throw Object.assign(
                new Error(
                    `ChatGPT returned an empty text response (finish_reason: ${finishReason})`
                ),
                { retryable: true }
            );
        }

        if (finishReason === 'length') {
            // max_completion_tokens 초과 — 동일 요청 재시도해도 결과는 같다.
            // ChatGPT는 thinking budget 축소 같은 mitigation이 없으므로 non-retryable로 throw해
            // 호출 측이 즉시 실패를 받고 모델/프롬프트 길이를 조정하도록 한다.
            console.warn('[ChatGPT] MAX_TOKENS: output truncated', {
                model,
                finishReason,
            });
            throw new Error(
                `ChatGPT hit output token limit (model: ${model})`
            );
        }

        if (finishReason === 'content_filter') {
            console.error('[ChatGPT] Response blocked by content filter', {
                model,
                finishReason,
            });
            throw new Error(
                `ChatGPT blocked response by content filter (finish_reason: ${finishReason})`
            );
        }

        // tool_calls / function_call / null 등 → 일시적 문제로 보고 재시도
        console.warn('[ChatGPT] Invalid response', {
            model,
            finishReason,
        });
        throw Object.assign(
            new Error(
                `Invalid ChatGPT response: finish_reason ${finishReason}`
            ),
            { retryable: true }
        );
    } finally {
        clearTimeout(timeoutId);
        options.signal?.removeEventListener('abort', propagateAbort);
    }
}
