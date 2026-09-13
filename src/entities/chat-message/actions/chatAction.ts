'use server';

import { getLlmProvider, getServerPrimaryKey } from '@/entities/llm-provider';
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
    CounterStoreUnavailableError,
    createCounterStore,
    DEEPSEEK_V4_1_FLASH_MODEL,
    DEFAULT_TIER,
    getProviderForModel,
    hashClientIp,
    requestChatCompletion,
    requiresByokKey,
    TIER_CONFIG,
} from '@y0ngha/siglens-core';
import type { AssetClass } from '@/shared/config/marketProfile';
import {
    currencyForSymbol,
    DEFAULT_MARKET_PROFILE,
    getDescriptor,
} from '@/shared/config/marketProfile';
import { getClientIp } from '@/shared/api/getClientIp';
import { getOrCreateGuestId } from '@/shared/api/guestId';

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

/**
 * Many guests can share one NAT/CGNAT address — this exists only to stop
 * clearing the `siglens_guest` cookie (`getOrCreateGuestId`) from buying
 * unlimited free chatbot turns from the same network, not to be a tight
 * per-guest limit. Mirrors the agent route's guest-IP backstop
 * (`stream/counters.ts`'s `GUEST_IP_TURNS_PER_DAY`).
 */
const GUEST_IP_BACKSTOP_MULTIPLE = 10;

/** Per-IP backstop consumed once per guest chatbot turn. Fails closed. */
function createChatGuestIpBackstopCounter() {
    return createCounterStore({
        prefix: 'chat:q:guest-ip',
        period: 'day',
        failurePolicy: 'closed',
    });
}

export async function chatAction(
    symbol: string,
    companyName: string,
    timeframe: Timeframe,
    analysis: AnalysisResponse,
    history: ChatMessage[],
    userMessage: string,
    model: ModelId = DEEPSEEK_V4_1_FLASH_MODEL,
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

        /**
         * Opaque per-visitor key core stores usage/tokens under — the
         * `clientIp` field name is historical, core only ever hashes it
         * (`hashUsageIp`/`hashClientIp`), never inspects it as an address.
         * A member's own id keys their own bucket; a guest's is the
         * `siglens_guest` cookie id (`shared/api/guestId.ts`) instead of the
         * client IP, so clearing browser data no longer resets a bucket a
         * whole office/CGNAT shares.
         */
        const clientKey = tierContext.userId
            ? `user:${tierContext.userId}`
            : `guest:${await getOrCreateGuestId()}`;

        if (tierContext.userId === null) {
            try {
                const guestIpLimit =
                    GUEST_IP_BACKSTOP_MULTIPLE *
                    TIER_CONFIG.limits.chatbotPerDay.free;
                const allowed =
                    await createChatGuestIpBackstopCounter().consume(
                        hashClientIp(clientIp),
                        guestIpLimit
                    );
                // Same code the per-guest token bucket returns, so the client
                // shows its localized "used up for now" copy — a structured
                // limit error would render its message verbatim (Korean only).
                if (!allowed) return { ok: false, error: 'token_exhausted' };
            } catch (error) {
                if (error instanceof CounterStoreUnavailableError)
                    return { ok: false, error: 'server_busy' };
                throw error;
            }
        }

        const r = await requestChatCompletion(
            {
                clientIp: clientKey,
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
                // core는 심볼에서 통화를 추론하지 않는다 — 한국 종목이면 원화 표기·프레이밍.
                currency: currencyForSymbol(symbol),
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
