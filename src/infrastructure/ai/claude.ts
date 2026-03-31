import Anthropic from '@anthropic-ai/sdk';
import type { RawAnalysisResponse } from '@/domain/types';
import type { AIProvider } from './types';
import { AI_SYSTEM_PROMPT, stripMarkdownCodeBlock } from './utils';

const CLAUDE_MODEL = 'claude-sonnet-4-6';
const CLAUDE_MAX_TOKENS = 2048;

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
