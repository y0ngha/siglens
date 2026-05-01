import { isClaudeModel, isGeminiModel, isSupportedModel } from './models.js';
import type { AIModel, ClaudeModel, GeminiModel } from './models.js';

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} environment variable is required`);
    }
    return value;
}

/**
 * Briefing 전용 provider 식별자.
 * Analyze는 client가 model을 직접 보내 제공자가 결정되므로 별도 환경변수가 필요 없다.
 */
export type AIProviderType = 'gemini' | 'claude';

function parseAIProvider(value: string | undefined): AIProviderType {
    if (value === undefined) return 'gemini';
    if (value === 'claude' || value === 'gemini') return value;
    throw new Error(`AI_PROVIDER must be 'claude' or 'gemini' (got: ${value})`);
}

function parseBriefingModel<T extends AIModel>(
    envName: string,
    fallback: T,
    providerCheck: (model: AIModel) => model is T
): T {
    const raw = process.env[envName];
    if (raw === undefined || raw === '') return fallback;
    if (!isSupportedModel(raw)) {
        throw new Error(`${envName} is not a supported model (got: ${raw})`);
    }
    if (!providerCheck(raw)) {
        throw new Error(
            `${envName} is not the expected provider model (got: ${raw})`
        );
    }
    return raw;
}

const aiProvider = parseAIProvider(process.env.AI_PROVIDER);

export const config = {
    port: Number(process.env.PORT ?? '8080'),
    workerSecret: requireEnv('WORKER_SECRET'),

    /** Briefing이 어느 provider를 사용하는지 결정한다. Analyze는 client model로 라우팅된다. */
    aiProvider,

    redis: {
        url: requireEnv('UPSTASH_REDIS_REST_URL'),
        token: requireEnv('UPSTASH_REDIS_REST_TOKEN'),
    },

    /**
     * Server-side AI provider keys.
     * - Analyze: SIGLENS_PROVIDED_MODELS 호출 시 server key 사용 (X-AI-API-KEY 미제공 경로).
     * - Briefing: 항상 server key 사용.
     * 모두 unconditional `requireEnv` — siglens 제공 free 모델 4종이 항상 사용 가능해야 한다.
     */
    gemini: {
        apiKey: requireEnv('GEMINI_API_KEY'),
        freeApiKey: process.env.GEMINI_FREE_API_KEY ?? '',
    },
    claude: {
        apiKey: requireEnv('ANTHROPIC_API_KEY'),
    },
    chatgpt: {
        apiKey: requireEnv('OPENAI_API_KEY'),
    },

    /**
     * Briefing 전용 model 기본값.
     * Analyze는 client가 model을 보내지만, briefing은 server-side에서 결정한다.
     */
    briefing: {
        claudeModel: parseBriefingModel<ClaudeModel>(
            'BRIEFING_CLAUDE_MODEL',
            'claude-haiku-3-5',
            isClaudeModel
        ),
        geminiModel: parseBriefingModel<GeminiModel>(
            'BRIEFING_GEMINI_MODEL',
            'gemini-2.5-flash-lite',
            isGeminiModel
        ),
    },
} as const;
