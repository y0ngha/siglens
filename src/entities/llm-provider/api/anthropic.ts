import 'server-only';
import { toProviderTurns, findSpecByApiModelId } from '../lib/utils';
import Anthropic from '@anthropic-ai/sdk';
import type { AiContents } from '@y0ngha/siglens-core';
import {
    isClaudeAdaptiveModelSpec,
    resolveReasoningConfig,
} from '@y0ngha/siglens-core';
import type { ProviderCallOptions } from '../model';
import { CHAT_JOB_ID, extractClaudeUsage, logUsage } from '../lib/usage';

/**
 * Ephemeral prompt-cache breakpoint. Reused for the stable system prefix and the
 * conversation-history breakpoint so repeated chat turns reuse the cached prefix
 * instead of re-billing it as fresh input tokens.
 */
const EPHEMERAL_CACHE_CONTROL = { type: 'ephemeral' } as const;

function toAnthropicMessages(contents: AiContents): Anthropic.MessageParam[] {
    // Safe cast: ProviderTurn is structurally compatible with MessageParam (role literals + string content).
    return toProviderTurns(contents) as Anthropic.MessageParam[];
}

/**
 * Marks the last *history* message (second-to-last overall) with an ephemeral
 * cache breakpoint, so the conversation prefix up to the previous turn is cached
 * and only the new (final) user turn is uncached.
 *
 * Returns the original `messages` unchanged (same reference) when there is no
 * history yet (fewer than 2 messages) or the second-to-last message already has
 * block content; otherwise returns a new array and never mutates the caller's
 * messages. Anthropic silently ignores prefixes below the model's min-cacheable
 * size, so no token counting is needed.
 *
 * Exported for unit-testing the already-block-content branch, which
 * `toAnthropicMessages` never produces in normal flow.
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

export async function callAnthropicChat({
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
    // 챗은 추론 토글이 없다 — 스펙의 기본 상태를 그대로 따른다. Free·Member 모델은
    // 기본 OFF라 서버 키로 도는 챗이 사고 토큰을 물지 않는다.
    const adaptiveThinking = isClaudeAdaptiveModelSpec(spec);
    const adaptiveConfig = adaptiveThinking
        ? resolveReasoningConfig(spec.reasoning, undefined)
        : undefined;
    const maxTokens = spec.maxOutputTokens;

    const startedAt = Date.now();
    const client = new Anthropic({ apiKey });
    // Two prompt-cache breakpoints keep repeated chat turns cheap: the stable
    // system prefix (persona + analysis context + few-shot) and the conversation
    // prefix up to the previous turn are cached, so each new turn only bills the
    // latest user message as fresh input tokens.
    const messages = withHistoryCacheBreakpoint(toAnthropicMessages(contents));
    const stream = client.messages.stream({
        model,
        max_tokens: maxTokens,
        messages,
        ...(systemInstruction !== undefined
            ? {
                  system: [
                      {
                          type: 'text',
                          text: systemInstruction,
                          cache_control: EPHEMERAL_CACHE_CONTROL,
                      },
                  ],
              }
            : {}),
        ...(adaptiveConfig !== undefined
            ? adaptiveConfig.mode === 'disabled'
                ? { thinking: { type: 'disabled' as const } }
                : {
                      thinking: {
                          type: 'adaptive' as const,
                          display: 'omitted' as const,
                      },
                      output_config: { effort: adaptiveConfig.effort },
                  }
            : { temperature: spec.temperature }),
    });
    const response = await stream.finalMessage();

    logUsage({
        jobId,
        model,
        latencyMs: Date.now() - startedAt,
        ...extractClaudeUsage(response.usage),
    });

    const block = response.content.find(b => b.type === 'text') as
        | Anthropic.TextBlock
        | undefined;
    if (!block) {
        throw new Error(
            `Anthropic returned no text content (stop_reason: ${response.stop_reason})`
        );
    }
    return block.text;
}
