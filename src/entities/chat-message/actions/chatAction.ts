'use server';

import { getLlmProvider } from '@/entities/llm-provider';
import { getLocale } from 'next-intl/server';
import { isLocale, DEFAULT_LOCALE, type Locale } from '@/shared/i18n/locales';
import { withLocaleDirective } from '../lib/localeEnvelope';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleUserApiKeyRepository } from '@/entities/api-key/api';
import { DrizzleUserRepository } from '@/entities/auth/api';
import { getUserTier } from '@/entities/user-tier';
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
    DEEPSEEK_V4_FLASH_MODEL,
    DEFAULT_TIER,
    getProviderForModel,
    requestChatCompletion,
    requiresByokKey,
} from '@y0ngha/siglens-core';
import type { AssetClass } from '@/shared/config/marketProfile';
import {
    DEFAULT_MARKET_PROFILE,
    getDescriptor,
} from '@/shared/config/marketProfile';
import { getClientIp } from '../api/getClientIp';

/**
 * Server-owned key per provider, forwarded to core as `serverApiKey` on
 * every request. Core charges it for free models (any tier) and pro-tier
 * premium models; non-pro premium requests are charged to the user's BYOK
 * key (`userApiKey`) instead.
 */
function getServerPrimaryKey(provider: LlmProvider): string | undefined {
    switch (provider) {
        case 'google':
            return process.env.GEMINI_CHAT_API_KEY;
        case 'anthropic':
            return process.env.ANTHROPIC_CHAT_API_KEY;
        case 'openai':
            return process.env.OPENAI_CHAT_API_KEY;
        case 'deepseek':
            return process.env.DEEPSEEK_CHAT_API_KEY;
        default: {
            const exhausted: never = provider;
            throw new Error(`Unhandled LLM provider: ${String(exhausted)}`);
        }
    }
}

/**
 * Resolve the user's tier and BYOK key for the given model.
 *
 * - Free models: no user context needed → default tier, no userApiKey.
 * - Premium models + no session: default tier, no userApiKey → core
 *   returns `user_api_key_required`.
 * - Premium models + pro tier: server covers the cost → tier returned,
 *   no userApiKey (BYOK is ignored even if registered).
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

/**
 * 요청 로케일. 서버 액션이 로케일 접두사 없는 경로(`/AAPL`)에서 호출되거나
 * 프록시가 헤더를 심지 못한 경우를 대비해 기본 로케일로 떨어뜨린다 — 여기서
 * 던지면 챗 전체가 `server_error`가 된다.
 */
async function resolveRequestLocale(): Promise<Locale> {
    try {
        const locale = await getLocale();
        return isLocale(locale) ? locale : DEFAULT_LOCALE;
    } catch {
        return DEFAULT_LOCALE;
    }
}

export async function chatAction(
    symbol: string,
    companyName: string,
    timeframe: Timeframe,
    analysis: AnalysisResponse,
    history: ChatMessage[],
    userMessage: string,
    model: ModelId = DEEPSEEK_V4_FLASH_MODEL,
    /**
     * Tagged union representing the analysis result the user is currently
     * looking at (technical / fundamental / news / overall). When provided,
     * core injects it into the system prompt as `## Current analysis context`
     * so the assistant can reference live numbers from the user's page. Pass
     * `null` (or omit) when no page-level analysis is available — core then
     * falls back to its default behavior.
     */
    currentAnalysisContext: CurrentAnalysisContext | null = null,
    assetClass: AssetClass = getDescriptor(DEFAULT_MARKET_PROFILE).assetClass
): Promise<ChatActionResult> {
    try {
        const provider = getProviderForModel(model);
        // 답변 언어 지시. core의 system prompt는 한국어를 요구하므로, 호출자의
        // 메시지 본문에 실어 보낸다(설계 §6.3 / SCOPE.md Step 6).
        const localizedMessage = withLocaleDirective(
            userMessage,
            await resolveRequestLocale()
        );
        const serverApiKey = getServerPrimaryKey(provider);

        const [{ tierContext, userApiKey }, clientIp] = await Promise.all([
            resolveUserContext(provider),
            getClientIp(),
        ]);

        /**
         * The server key is only required when *we* pay: free models on any
         * tier, and pro-tier premium models. A non-pro caller on a premium model
         * pays with their own BYOK key, so a missing server key must not block
         * them — this guard used to run before the tier was even known, turning
         * every such request into a generic `server_error`.
         *
         * When BYOK *is* required but no key is registered, core answers with
         * `user_api_key_required` — a far more actionable error than the generic
         * `server_error` this guard would return.
         *
         * All four `*_CHAT_API_KEY` are provisioned in production SSM and are
         * REQUIRED by `infra/aws/check-env.sh`; the condition below is about who
         * pays for a given request, not about which keys the environment happens
         * to carry.
         */
        if (!serverApiKey && !requiresByokKey(tierContext.tier, model)) {
            return { ok: false, error: 'server_error' };
        }

        const r = await requestChatCompletion(
            {
                clientIp,
                symbol,
                companyName,
                timeframe,
                analysis,
                history,
                userMessage: localizedMessage,
                model,
                serverApiKey,
                userApiKey,
                tierContext,
                // `undefined` (not `null`) when absent — core's optional field
                // is `currentAnalysisContext?: CurrentAnalysisContext`.
                ...(currentAnalysisContext !== null
                    ? { currentAnalysisContext }
                    : {}),
                assetClass,
            },
            {
                callAiProvider: getLlmProvider(),
            }
        );
        return r;
    } catch {
        return { ok: false, error: 'server_error' };
    }
}
