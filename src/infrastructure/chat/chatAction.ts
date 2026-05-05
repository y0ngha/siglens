'use server';

import { callAiProviderRouter } from '@/infrastructure/ai/router';
import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';
import { getDatabaseClient } from '@/infrastructure/db/client';
import { DrizzleUserApiKeyRepository } from '@/infrastructure/db/userApiKeyRepository';
import { DrizzleUserRepository } from '@/infrastructure/db/userRepository';
import { getUserTier } from '@/infrastructure/tier/use-cases/getUserTier';
import type {
    AnalysisResponse,
    ChatActionResult,
    ChatMessage,
    CurrentAnalysisContext,
    LlmProvider,
    ModelId,
    Timeframe,
    UserTierContext,
} from '@y0ngha/siglens-core';
import {
    DEFAULT_TIER,
    GEMINI_2_5_FLASH_MODEL,
    TIER_CONFIG,
    getProviderForModel,
    requestChatCompletion,
} from '@y0ngha/siglens-core';
import { headers } from 'next/headers';

async function getClientIp(): Promise<string> {
    const headersList = await headers();
    return (
        headersList.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    );
}

/**
 * Server-owned key per provider forwarded to core as `freeApiKey`.
 * Used for free models (any tier) and pro-tier premium models.
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
 * Resolve the user's tier and BYOK key for the given model.
 *
 * - Free models: no user context needed → default tier, no paidApiKey.
 * - Premium models + no session: default tier, no paidApiKey → core
 *   returns `user_api_key_required`.
 * - Premium models + pro tier: server covers the cost → tier returned,
 *   no paidApiKey (BYOK is ignored even if registered).
 * - Premium models + non-pro tier: BYOK looked up from DB.
 */
interface UserContext {
    tierContext: UserTierContext;
    paidApiKey: string | undefined;
}

async function resolveUserContext(
    model: ModelId,
    provider: LlmProvider
): Promise<UserContext> {
    // Safe cast: ModelId ⊆ string; Array.includes refuses a wider string
    // argument against a readonly literal-union without the widening cast.
    const isFreeModel = (TIER_CONFIG.models.free as readonly string[]).includes(
        model
    );
    if (isFreeModel) {
        return {
            tierContext: { userId: null, tier: DEFAULT_TIER },
            paidApiKey: undefined,
        };
    }

    const user = await getCurrentUser();
    if (!user) {
        return {
            tierContext: { userId: null, tier: DEFAULT_TIER },
            paidApiKey: undefined,
        };
    }

    const { db } = getDatabaseClient();
    const tier = await getUserTier(
        { userId: user.id },
        { users: new DrizzleUserRepository(db) }
    );

    // Pro tier: server covers premium model costs; BYOK not needed.
    if (tier === 'pro') {
        return {
            tierContext: { userId: user.id, tier },
            paidApiKey: undefined,
        };
    }

    const record = await new DrizzleUserApiKeyRepository(
        db
    ).findByUserAndProvider(user.id, provider);
    return {
        tierContext: { userId: user.id, tier },
        paidApiKey: record?.apiKey,
    };
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

        const [{ tierContext, paidApiKey }, clientIp] = await Promise.all([
            resolveUserContext(model, provider),
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
                tierContext,
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
    } catch (err) {
        console.error('Error occurred while fetching chat completion:', err);
        return { ok: false, error: 'server_error' };
    }
}
