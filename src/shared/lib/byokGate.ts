import 'server-only';

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

const GATE_MESSAGES: Record<AnalysisGateErrorCode, string> = {
    tier_premium_blocked:
        '선택한 모델은 프리미엄 등급에서만 사용 가능합니다. API 키를 등록하거나 등급을 업그레이드해 주세요.',
    invalid_model: '알 수 없는 모델입니다.',
    api_key_corrupted:
        '저장된 API 키를 복호화하지 못했습니다. 키를 다시 등록해 주세요.',
    unexpected_error:
        '예상치 못한 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
};

export function buildGateError(code: AnalysisGateErrorCode): AnalysisGateError {
    return { code, message: GATE_MESSAGES[code] };
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
 * Resolve a caller's tier without the BYOK/premium-model gate — used by
 * analysis surfaces that have no BYOK concept (e.g. congress trend, which is
 * public data with no premium model gating) but still need `tier` to decide
 * the reasoning toggle (member-reasoning-toggle spec Part A.3).
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
    modelId: ModelId
): Promise<ByokOutcome> {
    if (!isKnownModelId(modelId)) {
        return { kind: 'blocked', error: buildGateError('invalid_model') };
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
            error: buildGateError('tier_premium_blocked'),
        };
    }

    const llmProvider = getProviderForModel(modelId);
    try {
        const repo = new DrizzleUserApiKeyRepository(getDatabaseClient().db);
        const record = await repo.findByUserAndProvider(userId, llmProvider);
        if (record === null) {
            return {
                kind: 'blocked',
                error: buildGateError('tier_premium_blocked'),
            };
        }
        return { kind: 'allowed', tier, userApiKey: record.apiKey };
    } catch (error) {
        if (error instanceof LlmApiKeyDecryptionFailedError) {
            return {
                kind: 'blocked',
                error: buildGateError('api_key_corrupted'),
            };
        }
        throw error;
    }
}
