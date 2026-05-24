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

function toAnthropicMessages(contents: AiContents): Anthropic.MessageParam[] {
    // Safe cast: ProviderTurn is structurally compatible with MessageParam (role literals + string content).
    return toProviderTurns(contents) as Anthropic.MessageParam[];
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
    const stream = client.messages.stream({
        model,
        max_tokens: maxTokens,
        messages: toAnthropicMessages(contents),
        ...(systemInstruction !== undefined
            ? { system: systemInstruction }
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
