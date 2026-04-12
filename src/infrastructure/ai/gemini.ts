import { GoogleGenerativeAI } from '@google/generative-ai';
import type { RawAnalysisResponse } from '@/domain/types';
import type { AIProvider } from './types';
import { AI_SYSTEM_PROMPT, parseJsonResponse, parseNumberEnv } from './utils';

const DEFAULT_GEMINI_MODEL = 'gemini-3-flash-preview';
const DEFAULT_GEMINI_TEMPERATURE = 0;
const DEFAULT_GEMINI_TOP_P = 0.95;

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
const rawTemperature = parseNumberEnv(
    process.env.GEMINI_TEMPERATURE,
    DEFAULT_GEMINI_TEMPERATURE
);
const GEMINI_TEMPERATURE =
    rawTemperature >= 0 && rawTemperature <= 1
        ? rawTemperature
        : DEFAULT_GEMINI_TEMPERATURE;

const rawTopP = parseNumberEnv(process.env.GEMINI_TOP_P, DEFAULT_GEMINI_TOP_P);
const GEMINI_TOP_P =
    rawTopP > 0 && rawTopP <= 1 ? rawTopP : DEFAULT_GEMINI_TOP_P;

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

        return parseJsonResponse<RawAnalysisResponse>(text, 'Gemini API');
    }
}
