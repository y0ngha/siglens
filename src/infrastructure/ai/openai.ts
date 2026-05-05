import { toProviderTurns } from '@/infrastructure/ai/utils';
import type { AiContents, CallAiProviderOptions } from '@y0ngha/siglens-core';
import OpenAI from 'openai';

function toOpenAiMessages(
    contents: AiContents,
    systemInstruction?: string
): OpenAI.ChatCompletionMessageParam[] {
    const system: OpenAI.ChatCompletionMessageParam[] =
        systemInstruction !== undefined
            ? [{ role: 'system', content: systemInstruction }]
            : [];
    // Safe cast: ProviderTurn is structurally compatible with ChatCompletionMessageParam (role literals + string content).
    const turns = toProviderTurns(
        contents
    ) as OpenAI.ChatCompletionMessageParam[];
    return [...system, ...turns];
}

export async function callOpenaiChat({
    serverApiKey,
    model,
    contents,
    systemInstruction,
}: CallAiProviderOptions): Promise<string> {
    const client = new OpenAI({ apiKey: serverApiKey });
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
