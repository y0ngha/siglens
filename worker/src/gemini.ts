import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from './config.js';
import { AI_SYSTEM_PROMPT } from './ai-system-prompt.js';

const client = new GoogleGenerativeAI(config.gemini.apiKey);

export async function callGemini(prompt: string): Promise<string> {
    const model = client.getGenerativeModel({
        model: config.gemini.model,
        systemInstruction: AI_SYSTEM_PROMPT,
        generationConfig: {
            temperature: 0,
            topP: 0.95,
            responseMimeType: 'application/json',
        },
    });

    const start = Date.now();
    const result = await model.generateContent(prompt);
    const elapsed = Date.now() - start;
    console.log(`[Gemini] Response time: ${elapsed}ms`);

    return result.response.text();
}
