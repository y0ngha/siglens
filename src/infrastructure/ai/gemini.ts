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
    return response.text ?? '';
}
