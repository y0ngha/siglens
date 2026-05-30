import { toProviderTurns } from '../lib/utils';
import Anthropic from '@anthropic-ai/sdk';
import { MODEL_SPECS } from '@y0ngha/siglens-core';
import type {
    AiContents,
    CallAiProviderOptions,
    ModelSpec,
} from '@y0ngha/siglens-core';

/**
 * Allowed reasoning effort values accepted by the Anthropic adaptive thinking
 * `output_config.effort` field. Hoisted to module scope so the runtime guard
 * stays cheap and shareable across calls.
 *
 * The `Record<NonNullable<ModelSpec['effort']>, true>` shape forces compile-
 * time exhaustiveness against siglens-core: if the core widens `ModelSpec.effort`
 * with a new literal, TypeScript will reject this file until the new value
 * is mirrored — preventing the silent "valid effort gets thrown as invalid"
 * failure mode.
 */
const VALID_EFFORT_RECORD: Record<NonNullable<ModelSpec['effort']>, true> = {
    low: true,
    medium: true,
    high: true,
};

function isValidEffort(
    value: string
): value is NonNullable<ModelSpec['effort']> {
    return value in VALID_EFFORT_RECORD;
}

// apiModelId(e.g. 'claude-sonnet-4-6')로 ModelSpec을 역방향 조회한다.
function findSpecByApiModelId(apiModelId: string): ModelSpec | undefined {
    return (Object.values(MODEL_SPECS) as ModelSpec[]).find(
        s => s.apiModelId === apiModelId
    );
}

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
 * Returns a new array — never mutates the caller's messages — and is a no-op when
 * there is no history yet (fewer than 2 messages). Anthropic silently ignores
 * prefixes below the model's min-cacheable size, so no token counting is needed.
 *
 * @internal Exported only for unit-testing the already-block-content branch,
 * which `toAnthropicMessages` never produces in normal flow.
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
    serverApiKey,
    model,
    contents,
    systemInstruction,
}: CallAiProviderOptions): Promise<string> {
    const spec = findSpecByApiModelId(model);
    if (!spec) {
        throw new Error(`Unknown model: ${model}`);
    }
    if (spec.effort !== undefined && !isValidEffort(spec.effort)) {
        throw new Error(`[anthropic] Invalid effort value: ${spec.effort}`);
    }
    const adaptiveThinking = spec.effort !== undefined;
    const maxTokens = spec.maxOutputTokens;

    const client = new Anthropic({ apiKey: serverApiKey });
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
        ...(adaptiveThinking
            ? {
                  thinking: {
                      type: 'adaptive' as const,
                      display: 'omitted' as const,
                  },
                  output_config: { effort: spec.effort },
              }
            : { temperature: spec.temperature }),
    });
    const response = await stream.finalMessage();

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
