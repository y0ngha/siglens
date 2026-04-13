import { GoogleGenAI } from '@google/genai';
import { config } from './config.js';
import { AI_SYSTEM_PROMPT } from './ai-system-prompt.js';

const GEMINI_TIMEOUT_MS = 3600_000;

const client = new GoogleGenAI({ apiKey: config.gemini.apiKey });

export interface GeminiCallOptions {
    model?: string;
    thinking?: boolean;
}

export async function callGemini(
    prompt: string,
    options: GeminiCallOptions = {}
): Promise<string> {
    const modelName = options.model ?? config.gemini.model;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    const start = Date.now();
    try {
        const response = await client.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
                abortSignal: controller.signal,
                systemInstruction: AI_SYSTEM_PROMPT,
                temperature: 0,
                topP: 0.95,
                responseMimeType: 'application/json',
                ...(options.thinking === true && {
                    thinkingConfig: {
                        thinkingBudget: -1,
                        includeThoughts: false,
                    },
                }),
            },
        });

        const elapsed = Date.now() - start;
        console.log(
            `[Gemini] Response time: ${elapsed}ms (model: ${modelName})`
        );

        return response.text ?? '';
    } finally {
        clearTimeout(timeoutId);
    }
}
