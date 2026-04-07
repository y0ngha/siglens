import Anthropic from '@anthropic-ai/sdk';
import type { RawAnalysisResponse } from '@/domain/types';
import type { AIProvider } from './types';
import { AI_SYSTEM_PROMPT, stripMarkdownCodeBlock } from './utils';

const DEFAULT_CLAUDE_MODEL = 'claude-opus-4-6';
const DEFAULT_CLAUDE_MAX_TOKENS = 8192;

const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? DEFAULT_CLAUDE_MODEL;
const CLAUDE_MAX_TOKENS = (() => {
    const raw = process.env.CLAUDE_MAX_TOKENS;
    if (raw == null || raw === '') return DEFAULT_CLAUDE_MAX_TOKENS;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0
        ? parsed
        : DEFAULT_CLAUDE_MAX_TOKENS;
})();

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
            system: AI_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: prompt }],
        });

        const content = message.content[0];
        if (content.type !== 'text') {
            throw new Error('Unexpected response type from Claude API');
        }

        try {
            return JSON.parse(
                stripMarkdownCodeBlock(content.text)
            ) as RawAnalysisResponse;
        } catch (error) {
            console.error(
                'Failed to parse Claude API response. Raw text:',
                content.text
            );
            throw new Error('Failed to parse Claude API response as JSON', {
                cause: error,
            });
        }
    }
}
