import Anthropic from '@anthropic-ai/sdk';
import type { AnalysisResponse } from '@/domain/types';
import type { AIProvider } from './types';

const CLAUDE_MODEL = 'claude-sonnet-4-6';
const CLAUDE_MAX_TOKENS = 2048;
const CLAUDE_SYSTEM_PROMPT =
    'You are a financial analysis assistant. Always respond with pure JSON only. Do not wrap the response in markdown code blocks or any other formatting.';

const MARKDOWN_CODE_BLOCK_PATTERN = /```(?:json)?\s*\n?([\s\S]*?)\n?```/;

function stripMarkdownCodeBlock(text: string): string {
    const match = MARKDOWN_CODE_BLOCK_PATTERN.exec(text.trim());
    return match ? match[1].trim() : text.trim();
}

export class ClaudeProvider implements AIProvider {
    private readonly client: Anthropic;

    constructor() {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            throw new Error('ANTHROPIC_API_KEY must be set');
        }
        this.client = new Anthropic({ apiKey });
    }

    async analyze(prompt: string): Promise<AnalysisResponse> {
        const message = await this.client.messages.create({
            model: CLAUDE_MODEL,
            max_tokens: CLAUDE_MAX_TOKENS,
            system: CLAUDE_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: prompt }],
        });

        const content = message.content[0];
        if (content.type !== 'text') {
            throw new Error('Unexpected response type from Claude API');
        }

        try {
            return JSON.parse(
                stripMarkdownCodeBlock(content.text)
            ) as AnalysisResponse;
        } catch {
            throw new Error('Failed to parse Claude API response as JSON');
        }
    }
}
