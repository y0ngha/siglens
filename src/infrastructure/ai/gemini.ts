import { GoogleGenAI } from '@google/genai';

type GeminiContents =
    | string
    | Array<{ role: string; parts: Array<{ text: string }> }>;

interface GeminiCallOptions {
    apiKey: string;
    model: string;
    contents: GeminiContents;
    systemInstruction?: string;
}

async function callGemini({
    apiKey,
    model,
    contents,
    systemInstruction,
}: GeminiCallOptions): Promise<string> {
    const genai = new GoogleGenAI({ apiKey });
    const response = await genai.models.generateContent({
        model,
        contents,
        ...(systemInstruction !== undefined
            ? { config: { systemInstruction } }
            : {}),
    });
    return response.text ?? '';
}

export interface CallGeminiWithKeyFallbackOptions {
    freeApiKey: string | undefined;
    paidApiKey: string;
    model: string;
    contents: GeminiContents;
    systemInstruction?: string;
}

export async function callGeminiWithKeyFallback({
    freeApiKey,
    paidApiKey,
    model,
    contents,
    systemInstruction,
}: CallGeminiWithKeyFallbackOptions): Promise<string> {
    if (freeApiKey) {
        try {
            return await callGemini({
                apiKey: freeApiKey,
                model,
                contents,
                systemInstruction,
            });
        } catch {
            // free key failed (quota/rate limit) — fall through to paid key
        }
    }
    return callGemini({
        apiKey: paidApiKey,
        model,
        contents,
        systemInstruction,
    });
}
