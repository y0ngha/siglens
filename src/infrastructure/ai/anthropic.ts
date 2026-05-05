import { toProviderTurns } from '@/infrastructure/ai/utils';
import Anthropic from '@anthropic-ai/sdk';
import type { AiContents, CallAiProviderOptions } from '@y0ngha/siglens-core';

const ANTHROPIC_MAX_TOKENS = 8192;

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
    const client = new Anthropic({ apiKey: serverApiKey });
    const response = await client.messages.create({
        model,
        max_tokens: ANTHROPIC_MAX_TOKENS,
        messages: toAnthropicMessages(contents),
        ...(systemInstruction !== undefined
            ? { system: systemInstruction }
            : {}),
    });
    const block = response.content[0];
    if (!block || block.type !== 'text') {
        throw new Error(
            `Anthropic returned no text content (stop_reason: ${response.stop_reason})`
        );
    }
    return block.text;
}
