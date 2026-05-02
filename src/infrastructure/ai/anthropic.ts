import Anthropic from '@anthropic-ai/sdk';
import type { AiContents, CallAiProviderOptions, GeminiContent } from '@y0ngha/siglens-core';

const ANTHROPIC_MAX_TOKENS = 8192;

interface AnthropicCallOptions {
    apiKey: string;
    model: string;
    contents: AiContents;
    systemInstruction?: string;
}

function toAnthropicMessages(contents: AiContents): Anthropic.MessageParam[] {
    if (typeof contents === 'string') {
        return [{ role: 'user', content: contents }];
    }
    return contents.map((turn: GeminiContent) => ({
        role: turn.role === 'model' ? 'assistant' : 'user',
        content: turn.parts.map((p) => p.text).join(''),
    }));
}

async function callAnthropic({
    apiKey,
    model,
    contents,
    systemInstruction,
}: AnthropicCallOptions): Promise<string> {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
        model,
        max_tokens: ANTHROPIC_MAX_TOKENS,
        messages: toAnthropicMessages(contents),
        ...(systemInstruction !== undefined ? { system: systemInstruction } : {}),
    });
    const block = response.content[0];
    if (!block || block.type !== 'text') {
        throw new Error(`Anthropic returned no text content (stop_reason: ${response.stop_reason})`);
    }
    return block.text;
}

/** Call Anthropic with primary→fallback key fallback; primary errors are swallowed, fallback errors propagate. */
export async function callAnthropicChat({
    primaryApiKey,
    fallbackApiKey,
    model,
    contents,
    systemInstruction,
}: CallAiProviderOptions): Promise<string> {
    if (primaryApiKey) {
        try {
            return await callAnthropic({ apiKey: primaryApiKey, model, contents, systemInstruction });
        } catch {
            // primary key failed (quota/rate limit) — fall through to fallback key
        }
    }
    return callAnthropic({ apiKey: fallbackApiKey, model, contents, systemInstruction });
}
