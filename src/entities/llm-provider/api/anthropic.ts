import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type {
    AiContents,
    ClaudeAdaptiveReasoningConfig,
} from '@y0ngha/siglens-core';
import {
    isClaudeAdaptiveModelSpec,
    resolveReasoningConfig,
} from '@y0ngha/siglens-core';
import {
    findSpecByApiModelId,
    resolveMaxOutputTokens,
    toProviderTurns,
    toSdkTransportOptions,
} from '../lib/utils';
import type { ProviderCallOptions } from '../model';
import { CHAT_JOB_ID, extractClaudeUsage } from '../lib/usage';
import {
    createCallDeadline,
    runWithCallDeadline,
    toDeadlineRequestOptions,
} from './callDeadline';
import { logUsage } from './logUsage';

/**
 * 임시(ephemeral) 프롬프트 캐시 breakpoint. 안정적인 system 접두와 대화 이력 breakpoint에
 * 같이 써서, 반복되는 챗 턴이 캐시된 접두를 재사용하고 신규 입력 토큰으로 다시 과금되지 않게 한다.
 */
const EPHEMERAL_CACHE_CONTROL = { type: 'ephemeral' } as const;

type ThinkingParams = Pick<
    Anthropic.MessageStreamParams,
    'thinking' | 'output_config'
>;

function toAnthropicMessages(contents: AiContents): Anthropic.MessageParam[] {
    return toProviderTurns(contents);
}

/**
 * 추론 설정을 요청 필드로 옮긴다. 설정이 없으면(budget API 모델) 아무것도 보내지 않는다 —
 * budget API 모델에도 `spec.temperature`를 보내지 않는다. API 버전 2026-10-21(SDK 1.x)은
 * sampling 파라미터를 400으로 거부한다. 챗은 tool_choice를 쓰지 않는다.
 */
function toThinkingParams(
    config: ClaudeAdaptiveReasoningConfig | undefined
): ThinkingParams {
    if (config === undefined) return {};
    switch (config.mode) {
        case 'between_tools':
            // Sonnet 5.5의 추론 OFF — `disabled`는 400이다. `display`·`output_config.effort xhigh`와
            // 함께 보낼 수 없으므로 thinking 하나만 보낸다(2026-10-15 실측으로 API가 이 형태를 받음).
            return { thinking: { type: 'between_tools' } };
        case 'disabled':
            return { thinking: { type: 'disabled' } };
        case 'adaptive':
            return {
                thinking: { type: 'adaptive', display: 'omitted' },
                output_config: { effort: config.effort },
            };
        default: {
            const exhausted: never = config;
            throw new Error(
                `[anthropic] Unhandled reasoning mode: ${JSON.stringify(exhausted)}`
            );
        }
    }
}

/** system 지시문을 캐시 breakpoint가 달린 text 블록으로 싣는다. 지시문이 없으면 필드를 뺀다. */
function toSystemParam(
    systemInstruction: string | undefined
): Pick<Anthropic.MessageStreamParams, 'system'> {
    if (systemInstruction === undefined) return {};
    return {
        system: [
            {
                type: 'text',
                text: systemInstruction,
                cache_control: EPHEMERAL_CACHE_CONTROL,
            },
        ],
    };
}

function isTextBlock(
    block: Anthropic.ContentBlock
): block is Anthropic.TextBlock {
    return block.type === 'text';
}

/**
 * 마지막 *이력* 메시지(전체 기준 뒤에서 두 번째)에 ephemeral 캐시 breakpoint를 달아,
 * 직전 턴까지의 대화 접두는 캐시되고 새(마지막) user 턴만 비캐시가 되게 한다.
 *
 * 이력이 아직 없거나(메시지 2개 미만) 뒤에서 두 번째가 이미 블록 content면 원본 `messages`를
 * 같은 참조로 돌려주고, 아니면 새 배열을 돌려주며 호출자의 메시지는 바꾸지 않는다.
 * Anthropic은 모델의 최소 캐시 크기 미만 접두를 조용히 무시하므로 토큰을 셀 필요가 없다.
 *
 * `toAnthropicMessages`가 평소엔 만들지 않는 "이미 블록 content" 분기를 단위 테스트하려고 export한다.
 */
export function withHistoryCacheBreakpoint(
    messages: Anthropic.MessageParam[]
): Anthropic.MessageParam[] {
    if (messages.length < 2) {
        return messages;
    }
    const breakpointIdx = messages.length - 2;
    const target = messages[breakpointIdx];
    const text =
        typeof target.content === 'string' ? target.content : undefined;
    if (text === undefined) {
        // Already block content (shouldn't happen for our string turns); leave as-is.
        return messages;
    }
    return messages.map((message, index) =>
        index === breakpointIdx
            ? {
                  role: message.role,
                  content: [
                      {
                          type: 'text',
                          text,
                          cache_control: EPHEMERAL_CACHE_CONTROL,
                      },
                  ],
              }
            : message
    );
}

/**
 * Anthropic Messages API로 챗 한 번을 부르고 text 블록을 돌려준다.
 * 스트리밍으로 받아 `finalMessage()`로 모으며, `limits.timeoutMs`는 본문 읽기까지 묶는다.
 * 챗은 추론 토글이 없다 — 스펙의 기본 상태를 따르므로 Free·Member 모델은 기본 OFF라
 * 서버 키로 도는 챗이 사고 토큰을 물지 않는다.
 */
export async function callAnthropicChat({
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
    const adaptiveConfig = isClaudeAdaptiveModelSpec(spec)
        ? resolveReasoningConfig(spec.reasoning, undefined)
        : undefined;
    const maxTokens = resolveMaxOutputTokens(spec.maxOutputTokens, limits);

    const startedAt = Date.now();
    const client = new Anthropic({ apiKey, ...toSdkTransportOptions(limits) });
    // 프롬프트 캐시 breakpoint 두 개로 반복 챗 턴을 싸게 유지한다: 안정적인 system 접두(페르소나 +
    // 분석 컨텍스트 + few-shot)와 직전 턴까지의 대화 접두가 캐시되어, 새 턴은 마지막 user 메시지만
    // 신규 입력 토큰으로 과금된다.
    const messages = withHistoryCacheBreakpoint(toAnthropicMessages(contents));
    // 스트림 본문 읽기까지 `limits.timeoutMs`로 묶는다 — SDK timeout은 헤더 도착까지만 잰다.
    const deadline = createCallDeadline(limits?.timeoutMs);
    // `stream()` 생성이 던져도 타이머가 남지 않도록 생성까지 `runWithCallDeadline` 안에서 한다.
    const response = await runWithCallDeadline(deadline, () =>
        client.messages
            .stream(
                {
                    model,
                    max_tokens: maxTokens,
                    messages,
                    ...toSystemParam(systemInstruction),
                    ...toThinkingParams(adaptiveConfig),
                },
                toDeadlineRequestOptions(deadline)
            )
            .finalMessage()
    );

    logUsage({
        jobId,
        model,
        latencyMs: Date.now() - startedAt,
        ...extractClaudeUsage(response.usage),
    });

    const block = response.content.find(isTextBlock);
    if (!block) {
        throw new Error(
            `Anthropic returned no text content (stop_reason: ${response.stop_reason})`
        );
    }
    return block.text;
}
