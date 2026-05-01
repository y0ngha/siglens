import Anthropic from '@anthropic-ai/sdk';
import { AI_SYSTEM_PROMPT } from './ai-system-prompt.js';
import {
    CLAUDE_MODEL_MAX_TOKENS,
    CLAUDE_MODEL_THINKING_BUDGET,
} from './models.js';
import type { ClaudeModel } from './models.js';

type ClaudeTextBlock = Anthropic.Messages.TextBlock;

/**
 * MAX_TOKENS 에러 식별 코드.
 * thinking budget을 줄여 재시도해야 함을 호출 측에 알린다.
 */
export const MAX_TOKENS_CODE = 'CLAUDE_MAX_TOKENS';

const CLAUDE_TIMEOUT_MS = 3600_000;

const clientCache = new Map<string, Anthropic>();

function getClient(apiKey: string): Anthropic {
    let client = clientCache.get(apiKey);
    if (!client) {
        client = new Anthropic({ apiKey });
        clientCache.set(apiKey, client);
    }
    return client;
}

export interface ClaudeCallOptions {
    /** 호출에 사용할 Claude 모델. */
    model: ClaudeModel;
    /** 호출에 사용할 API key. user 키 또는 server 키. */
    apiKey: string;
    /**
     * thinking 활성 여부. 미지정 시 모델별 기본 thinking budget이 0이 아니면 활성.
     * `claude-haiku-3-5`는 thinking 미지원이므로 항상 비활성.
     */
    thinking?: boolean;
    /**
     * Thinking budget tokens. 활성 시 사용된다.
     * 미지정 시 `CLAUDE_MODEL_THINKING_BUDGET[model]`을 사용.
     */
    thinkingBudget?: number;
    /** 외부에서 전달되는 abort signal. */
    signal?: AbortSignal;
}

export async function callClaude(
    prompt: string,
    options: ClaudeCallOptions
): Promise<string> {
    const { model, apiKey } = options;
    const defaultBudget = CLAUDE_MODEL_THINKING_BUDGET[model];
    const requestedBudget = options.thinkingBudget ?? defaultBudget;
    // 모델이 thinking 미지원이면 강제로 비활성. requestedBudget=0이어도 비활성.
    const thinkingEnabled =
        defaultBudget > 0 &&
        requestedBudget > 0 &&
        (options.thinking ?? true);
    const maxTokens = CLAUDE_MODEL_MAX_TOKENS[model];

    const client = getClient(apiKey);

    const controller = new AbortController();
    // .unref()로 timer가 event loop를 점유하지 않게 하여 정상 종료를 막지 않도록 한다.
    const timeoutId = setTimeout(
        () => controller.abort(),
        CLAUDE_TIMEOUT_MS
    ).unref();
    // 외부 취소 신호를 타임아웃 컨트롤러에 전파 — abort 시 Anthropic HTTP 요청을 즉시 중단한다.
    // propagateAbort는 finally에서 제거해 신호가 발생하지 않은 경우의 리스너 누수를 방지한다.
    const propagateAbort = (): void => controller.abort();
    options.signal?.addEventListener('abort', propagateAbort, { once: true });

    const start = Date.now();
    try {
        const message = await client.messages.create(
            {
                model,
                max_tokens: maxTokens,
                system: AI_SYSTEM_PROMPT,
                messages: [{ role: 'user', content: prompt }],
                ...(thinkingEnabled
                    ? {
                          thinking: {
                              type: 'enabled' as const,
                              budget_tokens: requestedBudget,
                          },
                      }
                    : {
                          temperature: 0,
                          top_p: 0.95,
                      }),
            },
            { signal: controller.signal }
        );

        const elapsed = Date.now() - start;
        const stopReason = message.stop_reason;

        console.log(
            `[Claude] Response time: ${elapsed}ms (model: ${model}, stop_reason: ${stopReason})`
        );

        if (stopReason === 'end_turn') {
            // thinking 활성 시 응답에 ThinkingBlock + TextBlock이 섞여 있다 — text만 추출.
            // 명시적 type predicate로 좁혀 후속 narrow 가드 없이 textBlock.text에 접근한다.
            const textBlock = message.content.find(
                (block): block is ClaudeTextBlock => block.type === 'text'
            );
            if (textBlock) {
                return textBlock.text;
            }
            console.warn('[Claude] Empty text response', {
                model,
                stopReason,
            });
            throw Object.assign(
                new Error(
                    `Claude returned an empty text response (stop_reason: ${stopReason})`
                ),
                { retryable: true }
            );
        }

        if (stopReason === 'max_tokens') {
            // 출력 토큰 한도 초과 — 같은 budget으로 재시도해도 동일하게 실패한다.
            // non-retryable로 던져 호출 측에서 thinking budget을 줄여 재시도하도록 한다.
            console.warn('[Claude] MAX_TOKENS: output truncated', {
                model,
                stopReason,
            });
            throw Object.assign(
                new Error(`Claude hit output token limit (model: ${model})`),
                { code: MAX_TOKENS_CODE }
            );
        }

        if (stopReason === 'refusal') {
            // 안전 거절 — 재시도해도 동일하게 거절되므로 non-retryable로 처리한다.
            console.error('[Claude] Response refused by safety policy', {
                model,
                stopReason,
            });
            throw new Error(
                `Claude refused response (stop_reason: ${stopReason})`
            );
        }

        // stop_sequence / tool_use / pause_turn / null 등은 일시적 문제일 수 있어 재시도.
        console.warn('[Claude] Invalid response', {
            model,
            stopReason,
        });
        throw Object.assign(
            new Error(`Invalid Claude response: stop_reason ${stopReason}`),
            { retryable: true }
        );
    } finally {
        clearTimeout(timeoutId);
        options.signal?.removeEventListener('abort', propagateAbort);
    }
}
