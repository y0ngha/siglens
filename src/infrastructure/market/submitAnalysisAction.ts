'use server';

import { waitUntil } from '@vercel/functions';
import {
    TIER_CONFIG,
    getProviderForModel,
    submitAnalysis,
    type ModelId,
    type SubmitAnalysisGatedResult,
    type Timeframe,
} from '@y0ngha/siglens-core';
import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';
import { getDatabaseClient } from '@/infrastructure/db/client';
import { DrizzleUserApiKeyRepository } from '@/infrastructure/db/userApiKeyRepository';
import { getUserTier } from '@/infrastructure/tier/use-cases/getUserTier';
import { LlmApiKeyDecryptionFailedError } from '@/infrastructure/db/userApiKeyRepository';
import { DrizzleUserRepository } from '@/infrastructure/db/userRepository';

/** Machine-readable codes for siglens-side analysis gate denials. */
export type AnalysisGateErrorCode =
    | 'tier_premium_blocked'
    | 'invalid_model'
    | 'api_key_corrupted';

/** Gate error attached to the analysis submission result. */
export interface AnalysisGateError {
    code: AnalysisGateErrorCode;
    message: string;
}

/** Gate denial result mirroring core's `{ status: 'error' }` discriminator. */
export interface AnalysisGateBlockedResult {
    status: 'error';
    error: AnalysisGateError;
}

/** Final return type — core's gated result + our siglens-side gate errors. */
export type SubmitAnalysisActionResult =
    | SubmitAnalysisGatedResult
    | AnalysisGateBlockedResult;

const GATE_MESSAGES: Record<AnalysisGateErrorCode, string> = {
    tier_premium_blocked:
        '선택한 모델은 프리미엄 등급에서만 사용 가능합니다. API 키를 등록하거나 등급을 업그레이드해 주세요.',
    invalid_model: '알 수 없는 모델입니다.',
    api_key_corrupted:
        '저장된 API 키를 복호화하지 못했습니다. 키를 다시 등록해 주세요.',
};

function buildGateError(
    code: AnalysisGateErrorCode
): AnalysisGateBlockedResult {
    return {
        status: 'error',
        error: { code, message: GATE_MESSAGES[code] },
    };
}

/**
 * Returns true when `modelId` is recognized in `TIER_CONFIG.models` for any
 * tier. We treat unknown identifiers as invalid so the caller cannot route
 * arbitrary strings into the analysis worker.
 */
function isKnownModelId(modelId: string): boolean {
    // `TIER_CONFIG.models` values are typed as `readonly TierModel[]` (string
    // literal union). Widening to `readonly string[]` is a TS structural
    // limitation for `.includes(modelId: string)` — `Array.prototype.includes`
    // refuses non-literal arguments otherwise. The cast is safe because we
    // only read members; we never write back through this view.
    const allTiers = Object.values(
        TIER_CONFIG.models
    ) as readonly (readonly string[])[];
    return allTiers.some(models => models.includes(modelId));
}

/**
 * Authoritative server-side tier + BYOK gate executed before delegating to
 * core's `submitAnalysis`. Mirrors the BYOK resolution pattern used by
 * `chatAction` so the analysis pipeline cannot be invoked with a model the
 * user is not entitled to.
 */
export async function submitAnalysisAction(
    symbol: string,
    timeframe: Timeframe,
    force?: boolean,
    fmpSymbol?: string,
    modelId?: ModelId
): Promise<SubmitAnalysisActionResult> {
    const user = await getCurrentUser();
    const userId = user?.id ?? null;

    // No model selected → preserve previous behavior (let core pick a default).
    if (modelId === undefined) {
        return submitAnalysis(symbol, timeframe, force, fmpSymbol, {
            waitUntil,
            modelId,
        });
    }

    if (!isKnownModelId(modelId)) {
        return buildGateError('invalid_model');
    }

    const tier =
        userId === null
            ? 'free'
            : await getUserTier(
                  { userId },
                  {
                      users: new DrizzleUserRepository(getDatabaseClient().db),
                  }
              );

    // Widening `readonly TierModel[]` → `readonly string[]` is a TS-only
    // operation: same reasoning as `isKnownModelId` above. `.includes` cannot
    // accept the wider `string` against the literal-union without it.
    const freeModels = TIER_CONFIG.models.free as readonly string[];
    const tierModels = TIER_CONFIG.models[tier] as readonly string[];
    const isFreeModel = freeModels.includes(modelId);
    const isTierAllowed = tierModels.includes(modelId);

    let userApiKey: string | undefined;

    if (!isFreeModel) {
        // Premium model — require BYOK unless the user's tier already includes it.
        if (userId === null) {
            return buildGateError('tier_premium_blocked');
        }

        const llmProvider = getProviderForModel(modelId);
        try {
            const repo = new DrizzleUserApiKeyRepository(
                getDatabaseClient().db
            );
            const record = await repo.findByUserAndProvider(
                userId,
                llmProvider
            );
            if (record === null) {
                if (!isTierAllowed) {
                    return buildGateError('tier_premium_blocked');
                }
                // Tier covers the model and BYOK is not registered — fall through.
            } else {
                userApiKey = record.apiKey;
            }
        } catch (error) {
            if (error instanceof LlmApiKeyDecryptionFailedError) {
                return buildGateError('api_key_corrupted');
            }
            throw error;
        }
    }

    // Only include userApiKey when actually present so consumers can
    // distinguish "no BYOK" from "BYOK = undefined" via `'userApiKey' in opts`.
    return submitAnalysis(symbol, timeframe, force, fmpSymbol, {
        waitUntil,
        modelId,
        ...(userApiKey !== undefined ? { userApiKey } : {}),
    });
}
