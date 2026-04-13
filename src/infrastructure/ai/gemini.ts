import { GoogleGenAI } from '@google/genai';
import type { RawAnalysisResponse } from '@/domain/types';
import type { AIProvider } from './types';
import { AI_SYSTEM_PROMPT, parseJsonResponse, parseNumberEnv } from './utils';

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
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

/** @deprecated AI 호출은 Cloud Run worker에서 처리. 로컬 개발 폴백용으로만 유지. */
export class GeminiProvider implements AIProvider {
    private readonly freeClient: GoogleGenAI | null;
    private readonly paidClient: GoogleGenAI;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY must be set');
        }
        const freeApiKey = process.env.GEMINI_FREE_API_KEY;
        this.freeClient = freeApiKey
            ? new GoogleGenAI({ apiKey: freeApiKey })
            : null;
        this.paidClient = new GoogleGenAI({ apiKey });
    }

    private async callWithClient(
        client: GoogleGenAI,
        prompt: string
    ): Promise<RawAnalysisResponse> {
        const response = await client.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt,
            config: {
                systemInstruction: AI_SYSTEM_PROMPT,
                temperature: GEMINI_TEMPERATURE,
                topP: GEMINI_TOP_P,
                responseMimeType: 'application/json',
            },
        });

        return parseJsonResponse<RawAnalysisResponse>(
            response.text ?? '',
            'Gemini API'
        );
    }

    async analyze(prompt: string): Promise<RawAnalysisResponse> {
        if (this.freeClient) {
            try {
                return await this.callWithClient(this.freeClient, prompt);
            } catch {
                console.warn(
                    '[GeminiProvider] Free API key failed. Switching to paid key.'
                );
            }
        }

        return this.callWithClient(this.paidClient, prompt);
    }
}
