import Anthropic from '@anthropic-ai/sdk';
import type { RawAnalysisResponse } from '@/domain/types';
import type { AIProvider } from './types';
import { AI_SYSTEM_PROMPT, parseJsonResponse, parseNumberEnv } from './utils';

const DEFAULT_CLAUDE_MODEL = 'claude-opus-4-6';
const DEFAULT_CLAUDE_MAX_TOKENS = 8192;
const DEFAULT_CLAUDE_TEMPERATURE = 0;
const DEFAULT_CLAUDE_TOP_P = 0.95;

const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? DEFAULT_CLAUDE_MODEL;
const rawMaxTokens = Math.trunc(
    parseNumberEnv(process.env.CLAUDE_MAX_TOKENS, DEFAULT_CLAUDE_MAX_TOKENS)
);
const CLAUDE_MAX_TOKENS =
    rawMaxTokens > 0 ? rawMaxTokens : DEFAULT_CLAUDE_MAX_TOKENS;
const rawTemperature = parseNumberEnv(
    process.env.CLAUDE_TEMPERATURE,
    DEFAULT_CLAUDE_TEMPERATURE
);
const CLAUDE_TEMPERATURE =
    rawTemperature >= 0 && rawTemperature <= 1
        ? rawTemperature
        : DEFAULT_CLAUDE_TEMPERATURE;

const rawTopP = parseNumberEnv(process.env.CLAUDE_TOP_P, DEFAULT_CLAUDE_TOP_P);
const CLAUDE_TOP_P =
    rawTopP > 0 && rawTopP <= 1 ? rawTopP : DEFAULT_CLAUDE_TOP_P;

export class ClaudeProvider implements AIProvider {
    private readonly client: Anthropic;

    constructor() {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            throw new Error('ANTHROPIC_API_KEY must be set');
        }
        this.client = new Anthropic({ apiKey });
    }

    async analyze(prompt: string): Promise<RawAnalysisResponse> {
        const message = await this.client.messages.create({
            model: CLAUDE_MODEL,
            max_tokens: CLAUDE_MAX_TOKENS,
            temperature: CLAUDE_TEMPERATURE,
            top_p: CLAUDE_TOP_P,
            system: AI_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: prompt }],
        });

        const content = message.content[0];
        if (content.type !== 'text') {
            throw new Error('Unexpected response type from Claude API');
        }

        return parseJsonResponse<RawAnalysisResponse>(
            content.text,
            'Claude API'
        );
    }
}
