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

/** TIER_CONFIG.models의 어느 등급에든 등재된 modelId인지 검사 (미등록 ID는 차단). */
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

type ByokOutcome =
    | { kind: 'allowed'; userApiKey?: string }
    | { kind: 'blocked'; result: AnalysisGateBlockedResult };

/** Resolves BYOK outcome for a known modelId: free → allowed, premium → tier+BYOK gate. */
async function resolveByokOutcome(
    userId: string | null,
    modelId: ModelId,
    isFreeModel: boolean,
    isTierAllowed: boolean
): Promise<ByokOutcome> {
    if (isFreeModel) {
        return { kind: 'allowed' };
    }
    // Premium model — require BYOK unless the user's tier already includes it.
    if (userId === null) {
        return {
            kind: 'blocked',
            result: buildGateError('tier_premium_blocked'),
        };
    }

    const llmProvider = getProviderForModel(modelId);
    try {
        const repo = new DrizzleUserApiKeyRepository(getDatabaseClient().db);
        const record = await repo.findByUserAndProvider(userId, llmProvider);
        if (!isTierAllowed) {
            if (record === null) {
                return {
                    kind: 'blocked',
                    result: buildGateError('tier_premium_blocked'),
                };
            }
            // Tier doesn't cover the model but user has BYOK — use it.
            return { kind: 'allowed', userApiKey: record.apiKey };
        }
        // Tier covers the model: server pays regardless of BYOK registration.
        return { kind: 'allowed' };
    } catch (error) {
        if (error instanceof LlmApiKeyDecryptionFailedError) {
            return {
                kind: 'blocked',
                result: buildGateError('api_key_corrupted'),
            };
        }
        throw error;
    }
}

/** 서버사이드 tier + BYOK 게이트 후 core의 submitAnalysis에 위임. */
export async function submitAnalysisAction(
    symbol: string,
    companyName: string,
    timeframe: Timeframe,
    force?: boolean,
    fmpSymbol?: string,
    modelId?: ModelId
): Promise<SubmitAnalysisActionResult> {
    const user = await getCurrentUser();
    const userId = user?.id ?? null;

    // No model selected → preserve previous behavior (let core pick a default).
    if (modelId === undefined) {
        return submitAnalysis(symbol, companyName, timeframe, force, fmpSymbol, {
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

    const byok = await resolveByokOutcome(
        userId,
        modelId,
        isFreeModel,
        isTierAllowed
    );
    if (byok.kind === 'blocked') return byok.result;

    // Only include userApiKey when actually present so consumers can
    // distinguish "no BYOK" from "BYOK = undefined" via `'userApiKey' in opts`.
    return submitAnalysis(symbol, companyName, timeframe, force, fmpSymbol, {
        waitUntil,
        modelId,
        ...(byok.userApiKey !== undefined
            ? { userApiKey: byok.userApiKey }
            : {}),
    });
}
