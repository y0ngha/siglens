function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} environment variable is required`);
    }
    return value;
}

export const config = {
    port: Number(process.env.PORT ?? '3000'),
    redis: {
        url: requireEnv('UPSTASH_REDIS_REST_URL'),
        token: requireEnv('UPSTASH_REDIS_REST_TOKEN'),
    },
    gemini: {
        apiKey: requireEnv('GEMINI_API_KEY'),
        model: process.env.GEMINI_MODEL ?? 'gemini-3-flash-preview',
    },
} as const;
