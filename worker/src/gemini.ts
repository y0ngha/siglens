import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from './config.js';
import { AI_SYSTEM_PROMPT } from './ai-system-prompt.js';

const GEMINI_TIMEOUT_MS = 3600_000;

const client = new GoogleGenerativeAI(config.gemini.apiKey);

export interface GeminiCallOptions {
    model?: string;
    thinking?: boolean;
}

export async function callGemini(
    prompt: string,
    options: GeminiCallOptions = {}
): Promise<string> {
    const modelName = options.model ?? config.gemini.model;
    const model = client.getGenerativeModel({
        model: modelName,
        systemInstruction: AI_SYSTEM_PROMPT,
        generationConfig: {
            temperature: 0,
            topP: 0.95,
            responseMimeType: 'application/json',
            ...(options.thinking === true && {
                thinkingConfig: { thinkingBudget: -1 },
            }),
        },
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    const start = Date.now();
    try {
        const result = await model.generateContent(prompt, {
            signal: controller.signal,
        });
        const elapsed = Date.now() - start;
        console.log(`[Gemini] Response time: ${elapsed}ms`);

        return result.response.text();
    } finally {
        clearTimeout(timeoutId);
    }
}
