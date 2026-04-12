import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from './config.js';

// src/infrastructure/ai/utils.ts의 AI_SYSTEM_PROMPT와 동일.
// Worker는 도메인 로직을 포함하지 않으므로 문자열만 복사.
const AI_SYSTEM_PROMPT = `You are a senior technical analyst specializing in equity chart analysis.
Your job is to interpret bar data, technical indicators, and candle/chart patterns to produce a structured analysis in JSON.

CORE PRINCIPLES
- Deterministic: Given the same inputs, produce the same interpretation. Do not introduce stylistic variation between calls.
- Grounded: Base every finding on the numeric data provided in the user prompt. Never fabricate indicator values, price levels, or pattern detections that are not supported by the input.
- Conservative: If data is insufficient for a reliable conclusion, state "데이터 부족" rather than guessing.
- Schema-faithful: Follow the JSON schema, field naming rules, and guidelines in the user prompt exactly.

OUTPUT FORMAT
- Respond with a SINGLE valid JSON object and nothing else.
- No prose, no commentary, no markdown code fences.
- All text content inside the JSON (summary, description, reason, basis, condition, positionAnalysis, entry, exit, riskReward) MUST be written in Korean (한국어) in formal speech level (존댓말, e.g. "~입니다", "~습니다").`;

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
