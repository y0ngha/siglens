'use server';

import {
    GEMINI_2_5_FLASH_MODEL,
    TIER_CONFIG,
    getProviderForModel,
    requestChatCompletion,
} from '@y0ngha/siglens-core';
import type {
    AnalysisResponse,
    ChatActionResult,
    ChatMessage,
    LlmProvider,
    ModelId,
    Timeframe,
} from '@y0ngha/siglens-core';
import { headers } from 'next/headers';
import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';
import { getAuthDatabaseClient } from '@/infrastructure/auth/db';
import { DrizzleUserApiKeyRepository } from '@/infrastructure/db/userApiKeyRepository';
import { callAiProviderRouter } from '@/infrastructure/ai/router';

async function getClientIp(): Promise<string> {
    const headersList = await headers();
    return (
        headersList.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    );
}

function getServerPaidKey(provider: LlmProvider): string | undefined {
    switch (provider) {
        case 'google':
            return process.env.GEMINI_CHAT_API_KEY;
        case 'anthropic':
            return process.env.ANTHROPIC_CHAT_API_KEY;
        case 'openai':
            return process.env.OPENAI_CHAT_API_KEY;
        default: {
            const exhausted: never = provider;
            throw new Error(`Unhandled LLM provider: ${String(exhausted)}`);
        }
    }
}

function getServerFreeKey(provider: LlmProvider): string | undefined {
    // Only Google provides a free-quota fallback key; other providers use the paid key exclusively.
    switch (provider) {
        case 'google':
            return process.env.GEMINI_CHAT_FREE_API_KEY;
        case 'anthropic':
        case 'openai':
            return undefined;
        default: {
            const exhausted: never = provider;
            throw new Error(`Unhandled LLM provider: ${String(exhausted)}`);
        }
    }
}

async function resolvePaidApiKey(
    model: ModelId,
    provider: LlmProvider,
    serverPaidKey: string
): Promise<string | undefined> {
    // Safe cast: ModelId ⊆ string; Array.includes widens the argument type to string.
    if ((TIER_CONFIG.models.free as readonly string[]).includes(model)) {
        return serverPaidKey;
    }
    const user = await getCurrentUser();
    if (!user) return undefined;
    const { db } = getAuthDatabaseClient();
    const repo = new DrizzleUserApiKeyRepository(db);
    const record = await repo.findByUserAndProvider(user.id, provider);
    return record?.apiKey;
    // undefined → requestChatCompletion returns user_api_key_required
}

export async function chatAction(
    symbol: string,
    timeframe: Timeframe,
    analysis: AnalysisResponse,
    history: ChatMessage[],
    userMessage: string,
    model: ModelId = GEMINI_2_5_FLASH_MODEL
): Promise<ChatActionResult> {
    const provider = getProviderForModel(model);
    const serverPaidKey = getServerPaidKey(provider);
    if (!serverPaidKey) {
        return { ok: false, error: 'server_error' };
    }

    try {
        const [paidApiKey, clientIp] = await Promise.all([
            resolvePaidApiKey(model, provider, serverPaidKey),
            getClientIp(),
        ]);

        return await requestChatCompletion(
            {
                clientIp,
                symbol,
                timeframe,
                analysis,
                history,
                userMessage,
                model,
                freeApiKey: getServerFreeKey(provider),
                paidApiKey,
            },
            {
                callAiProvider: callAiProviderRouter,
            }
        );
    } catch {
        return { ok: false, error: 'server_error' };
    }
}
