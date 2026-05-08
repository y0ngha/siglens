import 'server-only';

import {
    TIER_CONFIG,
    getProviderForModel,
    isPremiumModel,
    type ModelId,
    type Tier,
} from '@y0ngha/siglens-core';
import { getDatabaseClient } from '@/infrastructure/db/client';
import {
    DrizzleUserApiKeyRepository,
    LlmApiKeyDecryptionFailedError,
} from '@/infrastructure/db/userApiKeyRepository';
import { getUserTier } from '@/infrastructure/tier/use-cases/getUserTier';
import { DrizzleUserRepository } from '@/infrastructure/db/userRepository';
import type {
    AnalysisGateError,
    AnalysisGateErrorCode,
} from '@/domain/analysis/gate';

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

    const tier =
        userId === null
            ? 'free'
            : await getUserTier(
                  { userId },
                  { users: new DrizzleUserRepository(getDatabaseClient().db) }
              );

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
