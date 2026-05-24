'use server';

import { callAiProviderRouter } from '@/entities/llm-provider';
import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleUserApiKeyRepository } from '@/entities/api-key';
import { DrizzleUserRepository } from '@/entities/user';
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
    userApiKey: string | undefined;
}

async function resolveUserContext(provider: LlmProvider): Promise<UserContext> {
    const user = await getCurrentUser();

    if (!user) {
        return {
            tierContext: { userId: null, tier: DEFAULT_TIER },
            userApiKey: undefined,
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
            userApiKey: undefined,
        };
    }

    const record = await new DrizzleUserApiKeyRepository(
        db
    ).findByUserAndProvider(user.id, provider);
    return {
        tierContext: { userId: user.id, tier },
        userApiKey: record?.apiKey,
    };
}

export async function chatAction(
    symbol: string,
    companyName: string,
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
        const serverApiKey = getServerPrimaryKey(provider);

        if (!serverApiKey) {
            return { ok: false, error: 'server_error' };
        }

        const [{ tierContext, userApiKey }, clientIp] = await Promise.all([
            resolveUserContext(provider),
            getClientIp(),
        ]);

        const r = await requestChatCompletion(
            {
                clientIp,
                symbol,
                companyName,
                timeframe,
                analysis,
                history,
                userMessage,
                model,
                serverApiKey,
                userApiKey,
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
        console.log(r);
        return r;
    } catch {
        return { ok: false, error: 'server_error' };
    }
}
