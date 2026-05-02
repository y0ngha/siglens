import { GoogleGenAI } from '@google/genai';
import type { AiContents, CallAiProviderOptions } from '@y0ngha/siglens-core';

interface GeminiCallOptions {
    apiKey: string;
    model: string;
    contents: AiContents;
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

/** Call Gemini with primary→fallback key fallback; primary errors are swallowed, fallback errors propagate. */
export async function callGeminiWithKeyFallback({
    primaryApiKey,
    fallbackApiKey,
    model,
    contents,
    systemInstruction,
}: CallAiProviderOptions): Promise<string> {
    if (primaryApiKey) {
        try {
            return await callGemini({
                apiKey: primaryApiKey,
                model,
                contents,
                systemInstruction,
            });
        } catch {
            // primary key failed (quota/rate limit) — fall through to fallback key
        }
    }
    return callGemini({
        apiKey: fallbackApiKey,
        model,
        contents,
        systemInstruction,
    });
}
