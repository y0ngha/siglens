import { toProviderTurns } from '@/infrastructure/ai/utils';
import Anthropic from '@anthropic-ai/sdk';
import { MODEL_SPECS } from '@y0ngha/siglens-core';
import type {
    AiContents,
    CallAiProviderOptions,
    ModelSpec,
} from '@y0ngha/siglens-core';

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
    const adaptiveThinking = spec.effort !== undefined;
    const maxTokens = spec.maxOutputTokens;

    const client = new Anthropic({ apiKey: serverApiKey });
    const response = await client.messages.create({
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
