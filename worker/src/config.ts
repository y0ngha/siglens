function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} environment variable is required`);
    }
    return value;
}

export type AIProviderType = 'gemini' | 'claude';

// AI_PROVIDER 환경변수는 배포 설정에서 'gemini' | 'claude'로 제한됨
const aiProvider = (process.env.AI_PROVIDER ?? 'gemini') as AIProviderType;

export const config = {
    port: Number(process.env.PORT ?? '8080'),
    workerSecret: requireEnv('WORKER_SECRET'),
    aiProvider,
    redis: {
        url: requireEnv('UPSTASH_REDIS_REST_URL'),
        token: requireEnv('UPSTASH_REDIS_REST_TOKEN'),
    },
    gemini: {
        apiKey: aiProvider === 'gemini' ? requireEnv('GEMINI_API_KEY') : '',
        model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
        fallbackModel:
            process.env.GEMINI_FALLBACK_MODEL ?? 'gemini-2.5-flash-lite',
    },
    claude: {
        apiKey: aiProvider === 'claude' ? requireEnv('ANTHROPIC_API_KEY') : '',
        model: process.env.CLAUDE_MODEL ?? 'claude-opus-4-6',
        maxTokens: Number(process.env.CLAUDE_MAX_TOKENS ?? '8192'),
    },
} as const;
