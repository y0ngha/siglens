import { GoogleGenAI } from '@google/genai';
import type {
    AiContents,
    CallAiProviderOptions,
    ConversationTurn,
} from '@y0ngha/siglens-core';

interface GeminiChatOptions extends CallAiProviderOptions {
    /**
     * Gemini thinking budget (token count). Pass `0` to explicitly disable
     * extended thinking for deterministic tasks (translation, classification).
     * Omit to use the model's default thinking behaviour.
     */
    thinkingBudget?: number;
}

/** Gemini SDK's native conversation-turn shape. */
interface GeminiTurn {
    role: 'user' | 'model';
    parts: [{ text: string }];
}

/**
 * Convert siglens-core's provider-neutral `AiContents` to the Gemini SDK's
 * native turn shape. Gemini expects `{ role: 'user' | 'model', parts: [{ text }] }`,
 * whereas siglens-core 0.11.4 emits `{ role: 'user' | 'assistant', text }`.
 */
function toGeminiContents(contents: AiContents): string | GeminiTurn[] {
    if (typeof contents === 'string') {
        return contents;
    }
    return contents.map((turn: ConversationTurn) => ({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: turn.text }],
    }));
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
        contents: toGeminiContents(contents),
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
