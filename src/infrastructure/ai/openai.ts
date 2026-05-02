import OpenAI from 'openai';
import type {
    AiContents,
    CallAiProviderOptions,
    GeminiContent,
} from '@y0ngha/siglens-core';

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

    if (typeof contents === 'string') {
        return [...system, { role: 'user', content: contents }];
    }

    const turns: OpenAI.ChatCompletionMessageParam[] = contents.map(
        (turn: GeminiContent) => ({
            role: turn.role === 'model' ? 'assistant' : 'user',
            content: turn.parts.map(p => p.text).join(''),
        })
    );
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
    return response.choices[0]?.message.content ?? '';
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
