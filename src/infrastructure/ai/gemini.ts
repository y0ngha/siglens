import { GoogleGenerativeAI } from '@google/generative-ai';
import type { RawAnalysisResponse } from '@/domain/types';
import type { AIProvider } from './types';
import {
    AI_SYSTEM_PROMPT,
    parseNumberEnv,
    stripMarkdownCodeBlock,
} from './utils';

const DEFAULT_GEMINI_MODEL = 'gemini-3-flash-preview';
const DEFAULT_GEMINI_TEMPERATURE = 0;
const DEFAULT_GEMINI_TOP_P = 0.95;

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
const GEMINI_TEMPERATURE = parseNumberEnv(
    process.env.GEMINI_TEMPERATURE,
    DEFAULT_GEMINI_TEMPERATURE
);
const GEMINI_TOP_P = parseNumberEnv(
    process.env.GEMINI_TOP_P,
    DEFAULT_GEMINI_TOP_P
);

export class GeminiProvider implements AIProvider {
    private readonly client: GoogleGenerativeAI;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY must be set');
        }
        this.client = new GoogleGenerativeAI(apiKey);
    }

    async analyze(prompt: string): Promise<RawAnalysisResponse> {
        const model = this.client.getGenerativeModel({
            model: GEMINI_MODEL,
            systemInstruction: AI_SYSTEM_PROMPT,
            generationConfig: {
                temperature: GEMINI_TEMPERATURE,
                topP: GEMINI_TOP_P,
                responseMimeType: 'application/json',
            },
        });

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        try {
            return JSON.parse(
                stripMarkdownCodeBlock(text)
            ) as RawAnalysisResponse;
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
