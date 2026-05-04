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
    CurrentAnalysisContext,
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

/**
 * Server-owned primary chat key per provider, mapped to core's `freeApiKey`.
 *
 * 0.7.3 semantics: `freeApiKey` is the server-owned primary credential that
 * core forwards to the AI provider. Without it core returns `server_error`
 * for every request. Google additionally honors `GEMINI_CHAT_FREE_API_KEY`
 * as the preferred primary; it falls back to `GEMINI_CHAT_API_KEY`.
 */
function getServerPrimaryKey(provider: LlmProvider): string | undefined {
    switch (provider) {
        case 'google':
            return (
                process.env.GEMINI_CHAT_FREE_API_KEY ??
                process.env.GEMINI_CHAT_API_KEY
            );
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

/**
 * Resolve user-registered BYOK key for the given premium model, mapped to
 * core's `paidApiKey` (the fallback credential).
 *
 * 0.7.3 semantics: free-tier models do not require a BYOK; core covers them
 * via `freeApiKey` alone. Premium models on a non-pro tier require a BYOK —
 * returning `undefined` lets core respond with `user_api_key_required` so
 * the UI can prompt the user to register a key.
 */
async function resolveUserByokKey(
    model: ModelId,
    provider: LlmProvider
): Promise<string | undefined> {
    // Safe cast: ModelId ⊆ string; Array.includes widens the argument type to string.
    if ((TIER_CONFIG.models.free as readonly string[]).includes(model)) {
        return undefined;
    }
    const user = await getCurrentUser();
    if (!user) return undefined;
    const { db } = getAuthDatabaseClient();
    const repo = new DrizzleUserApiKeyRepository(db);
    const record = await repo.findByUserAndProvider(user.id, provider);
    return record?.apiKey;
}

export async function chatAction(
    symbol: string,
    timeframe: Timeframe,
    analysis: AnalysisResponse,
    history: ChatMessage[],
    userMessage: string,
    model: ModelId = GEMINI_2_5_FLASH_MODEL,
    /**
     * Tagged union representing the analysis result the user is currently
     * looking at (technical / fundamental / news / overall). When provided,
     * core injects it into the system prompt as `## Current analysis context`
     * so the assistant can reference live numbers from the user's page. Pass
     * `null` (or omit) when no page-level analysis is available — core then
     * falls back to its default behavior.
     */
    currentAnalysisContext: CurrentAnalysisContext | null = null
): Promise<ChatActionResult> {
    try {
        const provider = getProviderForModel(model);
        const freeApiKey = getServerPrimaryKey(provider);
        if (!freeApiKey) {
            return { ok: false, error: 'server_error' };
        }

        const [paidApiKey, clientIp] = await Promise.all([
            resolveUserByokKey(model, provider),
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
                freeApiKey,
                paidApiKey,
                // `undefined` (not `null`) when absent — core's optional field
                // is `currentAnalysisContext?: CurrentAnalysisContext`.
                ...(currentAnalysisContext !== null
                    ? { currentAnalysisContext }
                    : {}),
            },
            {
                callAiProvider: callAiProviderRouter,
            }
        );
    } catch {
        return { ok: false, error: 'server_error' };
    }
}
