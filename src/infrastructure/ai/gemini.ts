import { GoogleGenAI } from '@google/genai';
import type { CallAiProviderOptions } from '@y0ngha/siglens-core';

export async function callGeminiChat({
    serverApiKey,
    model,
    contents,
    systemInstruction,
}: CallAiProviderOptions): Promise<string> {
    const genai = new GoogleGenAI({ apiKey: serverApiKey });
    const response = await genai.models.generateContent({
        model,
        contents,
        ...(systemInstruction !== undefined
            ? { config: { systemInstruction } }
            : {}),
    });
    if (response.text === null || response.text === undefined) {
        throw new Error('[gemini] Provider returned null/undefined response');
    }
    return response.text;
}
