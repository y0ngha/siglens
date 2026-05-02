import OpenAI from 'openai';
import type { AiContents, CallAiProviderOptions } from '@y0ngha/siglens-core';
import { toProviderTurns } from '@/infrastructure/ai/utils';

interface OpenAiCallOptions {
    apiKey: string;
    model: string;
    contents: AiContents;
    systemInstruction?: string;
}

function toOpenAiMessages(
    contents: AiContents,
    systemInstruction?: string
): OpenAI.ChatCompletionMessageParam[] {
    const system: OpenAI.ChatCompletionMessageParam[] =
        systemInstruction !== undefined
            ? [{ role: 'system', content: systemInstruction }]
            : [];
    // Safe cast: toProviderTurns returns { role: 'user' | 'assistant'; content: string }[]
    // which is structurally compatible with ChatCompletionMessageParam — role is always one
    // of the two valid literals and string satisfies the content union at runtime.
    const turns = toProviderTurns(
        contents
    ) as OpenAI.ChatCompletionMessageParam[];
    return [...system, ...turns];
}

async function callOpenai({
    apiKey,
    model,
    contents,
    systemInstruction,
}: OpenAiCallOptions): Promise<string> {
    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
        model,
        messages: toOpenAiMessages(contents, systemInstruction),
    });
    const content = response.choices[0]?.message.content;
    if (content == null) {
        throw new Error('OpenAI returned no text content');
    }
    return content;
}

/** Call OpenAI with primary→fallback key fallback; primary errors are swallowed, fallback errors propagate. */
export async function callOpenaiChat({
    primaryApiKey,
    fallbackApiKey,
    model,
    contents,
    systemInstruction,
}: CallAiProviderOptions): Promise<string> {
    if (primaryApiKey) {
        try {
            return await callOpenai({
                apiKey: primaryApiKey,
                model,
                contents,
                systemInstruction,
            });
        } catch {
            // primary key failed (quota/rate limit) — fall through to fallback key
        }
    }
    return callOpenai({
        apiKey: fallbackApiKey,
        model,
        contents,
        systemInstruction,
    });
}
