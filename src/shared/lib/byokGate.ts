import 'server-only';
import type { Locale } from '@/shared/i18n/locales';
import { getTranslations } from 'next-intl/server';

import {
    TIER_CONFIG,
    bucketizePosition,
    getProviderForModel,
    isPremiumModel,
    type ModelId,
    type PositionBucket,
    type Tier,
} from '@y0ngha/siglens-core';
import { getDatabaseClient } from '@/shared/db/client';
import {
    DrizzleUserApiKeyRepository,
    LlmApiKeyDecryptionFailedError,
} from '@/entities/api-key/api';
import { getUserTier } from '@/entities/user-tier';
import { DrizzleUserRepository } from '@/entities/auth/api';
import type { AnalysisGateError, AnalysisGateErrorCode } from './types';

/**
 * 게이트 문구는 **카탈로그에서** 온다.
 *
 * 예전에는 여기 한국어 리터럴 4개가 박혀 있었고, 그 값이 두 경로로 브라우저에
 * 그대로 갔다: SSE `error` 이벤트, 그리고 액션이 돌려주는
 * `{ status: 'error', error }`를 훅들이 `result.error.message`로 다시 던지는
 * 경로. 실측으로 ja·en 사용자가 한국어 문장을 봤다.
 *
 * 호출부마다 번역하면 또 빠뜨리므로 **여기 한 곳에서** 번역한다.
 *
 * ⚠️ **로케일을 인자로 받아야 한다.** `getTranslations()`를 인자 없이 부르면
 * next-intl이 요청 스코프에서 로케일을 찾는데, 이 코드가 도는 `/api/*`는
 * `proxy.ts`의 matcher에서 **제외**돼 있어 `setRequestLocale`도
 * `X-NEXT-INTL-LOCALE`도 없다. 결과는 항상 기본 로케일(ko)이다. 실제 로케일은
 * 별도 헤더 `x-siglens-locale`로 전달된다(`locales.ts`의 `ANALYSIS_LOCALE_HEADER`).
 *
 * 그렇게 나간 한국어가 화면에서는 번역된 것처럼 보였는데, 그건 오직
 * `message`가 `PROSE_FIELD_NAMES`에 들어 있어 **분석 번역 LLM이 우연히**
 * 옮겨줬기 때문이다 — 번역 키가 없거나 LLM이 실패하면 그대로 한국어였다.
 */
async function gateMessage(
    locale: Locale,
    code: AnalysisGateErrorCode
): Promise<string> {
    try {
        const t = await getTranslations({
            locale,
            namespace: 'shared.lib.byokGate',
        });
        return t(code);
    } catch {
        // 카탈로그 조회가 실패해도 게이트 판정 자체는 계속돼야 한다.
        return code;
    }
}

export async function buildGateError(
    code: AnalysisGateErrorCode,
    locale: Locale
): Promise<AnalysisGateError> {
    return { code, message: await gateMessage(locale, code) };
}

// Module-level cache: TIER_CONFIG is frozen, this is computed once at module load.
// `TIER_CONFIG.models` values are typed as `readonly TierModel[]` (string-literal
// union). Widening to `readonly string[]` lets `.includes(modelId: string)` accept
// the wider arg; TS cannot express this constraint — runtime is guaranteed by TIER_CONFIG.
const ALL_TIER_MODEL_LISTS = Object.values(
    TIER_CONFIG.models
) as readonly (readonly string[])[];

/** TIER_CONFIG.models의 어느 등급에든 등재된 modelId인지 검사. */
export function isKnownModelId(modelId: string): boolean {
    return ALL_TIER_MODEL_LISTS.some(models => models.includes(modelId));
}

export type ByokOutcome =
    | { kind: 'allowed'; tier: Tier; userApiKey?: string }
    | { kind: 'blocked'; error: AnalysisGateError };

/**
 * Resolve a caller's tier without the BYOK/premium-model gate. This lists
 * the direct call sites; every gated submit action also reaches this
 * function indirectly, through `resolveTierAndByok` calling it internally
 * as its first step (see the "Indirect caller" note below).
 *
 * Direct callers:
 *
 * - the SSE route (`src/app/api/analysis/stream/route.ts`) — two branches call
 *   it. The `modelId === undefined` branch is genuinely modelId-less
 *   (chart/technical analysis submitted with no model selection at all, so
 *   there is nothing to gate on). The
 *   `isE2E()` branch is entered regardless of `modelId` — a caller can still
 *   pass a premium model there — but it short-circuits to a stub fixture
 *   before any `modelId` gating would run, so no gate applies on that branch
 *   either, just not because it is modelId-less.
 * - `resolveCallerTier`, consumed by `getBarsAction` — it DOES gate: `isTimeframeAllowed(tier,
 *   timeframe)` throws when the resolved tier can't access the requested
 *   timeframe. It never goes through `resolveTierAndByok` because that gate
 *   is unrelated to `modelId`/premium-model BYOK: `getBarsAction` has no
 *   `modelId` parameter to check in the first place.
 *
 * Indirect caller: `resolveTierAndByok` (below) calls this function first to
 * get `tier`, then layers the premium-model/BYOK check on top. Every gated
 * analysis action (e.g. `submitCongressTrendAction`, and the gated branch of
 * the SSE route) reaches `resolveTierOnly` this way.
 *
 * Congress trend analysis used to be gated this way too (public filings, "no
 * premium gate" was the assumption) but that was a bug: a congress caller CAN
 * request a premium `modelId` at submit time, so it now goes through
 * `resolveTierAndByok` like every other submit action — see
 * `submitCongressTrendAction`'s doc comment.
 *
 * @param userId - Authenticated user ID. `null` (anonymous) resolves to `'free'`.
 */
export async function resolveTierOnly(userId: string | null): Promise<Tier> {
    if (userId === null) return 'free';
    return getUserTier(
        { userId },
        { users: new DrizzleUserRepository(getDatabaseClient().db) }
    );
}

/**
 * Server-side enforcement of the reasoning ("깊은 생각") toggle
 * (member-reasoning-toggle spec Part A.3).
 *
 * Anonymous and free-tier callers can never receive `reasoning: true`
 * regardless of what the client sent — the client value is only honored for
 * `member`/`pro` tiers. This is the single source of truth for that rule; all
 * analysis submit actions must route their client-supplied `reasoning`
 * through this function before forwarding it to siglens-core.
 *
 * @param tier - Resolved caller tier (`resolveTierAndByok`/`resolveTierOnly`).
 * @param clientReasoning - Raw value from the request. Ignored for `free`.
 */
export function resolveReasoning(
    tier: Tier,
    clientReasoning?: boolean
): boolean {
    return tier !== 'free' && clientReasoning === true;
}

/**
 * Server-side gate deriving the coarse position bucket used to personalize
 * an analysis to a member's holding (personalized-analysis-by-position-bucket
 * spec, Subsystem C).
 *
 * Free tier (anonymous included) never receives a bucket regardless of the
 * inputs — mirrors `resolveReasoning`'s tier gate. `avgPrice`/`currentPrice`
 * are expected to already be server-read values (the action layer is
 * responsible for never trusting a client-supplied average); `null` for
 * either (no holding, or a failed/unavailable price read) degrades to
 * `undefined` (no bucket, i.e. the shared/base analysis and cache key).
 * `bucketizePosition`'s own `null` (non-positive/non-finite inputs) is
 * likewise folded into `undefined`.
 *
 * @param tier - Resolved caller tier.
 * @param avgPrice - Member's server-read average cost basis for this symbol,
 *   or `null` when no holding exists.
 * @param currentPrice - Current (or last-cached) price used for the
 *   analysis, or `null` when it could not be read.
 */
export function resolvePositionBucket(
    tier: Tier,
    avgPrice: number | null,
    currentPrice: number | null
): PositionBucket | undefined {
    if (tier === 'free' || avgPrice === null || currentPrice === null) {
        return undefined;
    }
    return bucketizePosition(avgPrice, currentPrice) ?? undefined;
}

/**
 * Tier 조회 + BYOK 게이트.
 *
 * @param userId - 인증된 사용자 ID. null이면 free tier로 처리.
 * @param modelId - 선택된 모델.
 * @returns `allowed`: tier + (있으면) userApiKey. `blocked`: 게이트 사유.
 */
export async function resolveTierAndByok(
    userId: string | null,
    modelId: ModelId,
    /** 게이트 거부 문구를 만들 로케일. `buildGateError` JSDoc 참고. */
    locale: Locale
): Promise<ByokOutcome> {
    if (!isKnownModelId(modelId)) {
        return {
            kind: 'blocked',
            error: await buildGateError('invalid_model', locale),
        };
    }

    const tier = await resolveTierOnly(userId);

    const premium = isPremiumModel(modelId);

    // pro 또는 free 모델 → server pays, no BYOK needed.
    if (tier === 'pro' || !premium) {
        return { kind: 'allowed', tier };
    }

    // userId가 없으면 BYOK를 조회할 주체가 없어 차단.
    if (userId === null) {
        return {
            kind: 'blocked',
            error: await buildGateError('tier_premium_blocked', locale),
        };
    }

    const llmProvider = getProviderForModel(modelId);
    try {
        const repo = new DrizzleUserApiKeyRepository(getDatabaseClient().db);
        const record = await repo.findByUserAndProvider(userId, llmProvider);
        if (record === null) {
            return {
                kind: 'blocked',
                error: await buildGateError('tier_premium_blocked', locale),
            };
        }
        return { kind: 'allowed', tier, userApiKey: record.apiKey };
    } catch (error) {
        if (error instanceof LlmApiKeyDecryptionFailedError) {
            return {
                kind: 'blocked',
                error: await buildGateError('api_key_corrupted', locale),
            };
        }
        throw error;
    }
}
