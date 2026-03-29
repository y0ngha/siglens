import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AnalysisResponse } from '@/domain/types';
import type { AIProvider } from './types';
import { AI_SYSTEM_PROMPT, stripMarkdownCodeBlock } from './utils';

const GEMINI_MODEL = 'gemini-1.5-flash';

export class GeminiProvider implements AIProvider {
    private readonly client: GoogleGenerativeAI;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY must be set');
        }
        this.client = new GoogleGenerativeAI(apiKey);
    }

    async analyze(prompt: string): Promise<AnalysisResponse> {
        const model = this.client.getGenerativeModel({
            model: GEMINI_MODEL,
            systemInstruction: AI_SYSTEM_PROMPT,
        });

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        try {
            return JSON.parse(stripMarkdownCodeBlock(text)) as AnalysisResponse;
        } catch (error) {
            console.error(
                'Failed to parse Gemini API response. Raw text:',
                text
            );
            throw new Error('Failed to parse Gemini API response as JSON', {
                cause: error,
            });
        }
    }
}
