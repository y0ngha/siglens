function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} environment variable is required`);
    }
    return value;
}

export type AIProviderType = 'gemini' | 'claude';

const aiProvider = (process.env.AI_PROVIDER ?? 'gemini') as AIProviderType;

export const config = {
    port: Number(process.env.PORT ?? '3000'),
    aiProvider,
    redis: {
        url: requireEnv('UPSTASH_REDIS_REST_URL'),
        token: requireEnv('UPSTASH_REDIS_REST_TOKEN'),
    },
    gemini: {
        apiKey: aiProvider === 'gemini' ? requireEnv('GEMINI_API_KEY') : '',
        model: process.env.GEMINI_MODEL ?? 'gemini-3-flash-preview',
    },
    claude: {
        apiKey: aiProvider === 'claude' ? requireEnv('ANTHROPIC_API_KEY') : '',
        model: process.env.CLAUDE_MODEL ?? 'claude-opus-4-6',
        maxTokens: Number(process.env.CLAUDE_MAX_TOKENS ?? '8192'),
    },
} as const;
