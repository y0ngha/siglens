import { GoogleGenAI } from '@google/genai';
import type { CallAiProviderOptions } from '@y0ngha/siglens-core';

interface GeminiChatOptions extends CallAiProviderOptions {
    /**
     * Gemini thinking budget (token count). Pass `0` to explicitly disable
     * extended thinking for deterministic tasks (translation, classification).
     * Omit to use the model's default thinking behaviour.
     */
    thinkingBudget?: number;
}

export async function callGeminiChat({
    serverApiKey,
    model,
    contents,
    systemInstruction,
    thinkingBudget,
}: GeminiChatOptions): Promise<string> {
    const genai = new GoogleGenAI({ apiKey: serverApiKey });

    const hasSystemInstruction = systemInstruction !== undefined;
    const hasThinkingBudget = thinkingBudget !== undefined;

    const response = await genai.models.generateContent({
        model,
        contents,
        ...(hasSystemInstruction || hasThinkingBudget
            ? {
                  config: {
                      ...(hasSystemInstruction ? { systemInstruction } : {}),
                      ...(hasThinkingBudget
                          ? { thinkingConfig: { thinkingBudget } }
                          : {}),
                  },
              }
            : {}),
    });
    if (response.text === null || response.text === undefined) {
        throw new Error('[gemini] Provider returned null/undefined response');
    }
    return response.text;
}
