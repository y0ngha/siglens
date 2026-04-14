import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';
import { AI_SYSTEM_PROMPT } from './ai-system-prompt.js';

const client = new Anthropic({ apiKey: config.claude.apiKey });

export async function callClaude(
    prompt: string,
    signal?: AbortSignal
): Promise<string> {
    const start = Date.now();
    const message = await client.messages.create(
        {
            model: config.claude.model,
            max_tokens: config.claude.maxTokens,
            temperature: 0,
            top_p: 0.95,
            system: AI_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: prompt }],
        },
        { signal }
    );

    const elapsed = Date.now() - start;
    console.log(`[Claude] Response time: ${elapsed}ms`);

    const content = message.content[0];
    if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude API');
    }

    return content.text;
}
