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

/** Machine-readable codes for siglens-side analysis gate denials. */
export type AnalysisGateErrorCode =
    | 'tier_premium_blocked'
    | 'invalid_model'
    | 'api_key_corrupted';

export interface AnalysisGateError {
    code: AnalysisGateErrorCode;
    message: string;
}

const GATE_MESSAGES: Record<AnalysisGateErrorCode, string> = {
    tier_premium_blocked:
        '선택한 모델은 프리미엄 등급에서만 사용 가능합니다. API 키를 등록하거나 등급을 업그레이드해 주세요.',
    invalid_model: '알 수 없는 모델입니다.',
    api_key_corrupted:
        '저장된 API 키를 복호화하지 못했습니다. 키를 다시 등록해 주세요.',
};

export function buildGateError(code: AnalysisGateErrorCode): AnalysisGateError {
    return { code, message: GATE_MESSAGES[code] };
}

/** TIER_CONFIG.models의 어느 등급에든 등재된 modelId인지 검사. */
export function isKnownModelId(modelId: string): boolean {
    // `TIER_CONFIG.models` values are typed as `readonly TierModel[]` (string-
    // literal union). Widening to `readonly string[]` lets `.includes(modelId: string)`
    // accept the wider arg; same pattern as in the original submitAnalysisAction.
    const allTiers = Object.values(
        TIER_CONFIG.models
    ) as readonly (readonly string[])[];
    return allTiers.some(models => models.includes(modelId));
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

    // non-pro + premium → BYOK 필수.
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
