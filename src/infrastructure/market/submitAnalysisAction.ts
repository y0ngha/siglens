'use server';

import { waitUntil } from '@vercel/functions';
import {
    submitAnalysis,
    type ModelId,
    type SubmitAnalysisGatedResult,
    type Timeframe,
} from '@y0ngha/siglens-core';
import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';
import {
    resolveTierAndByok,
    type AnalysisGateError,
} from '@/infrastructure/market/byokGate';

export type AnalysisGateErrorCode =
    | 'tier_premium_blocked'
    | 'invalid_model'
    | 'api_key_corrupted';

/** Gate denial result mirroring core's `{ status: 'error' }` discriminator. */
export interface AnalysisGateBlockedResult {
    status: 'error';
    error: AnalysisGateError;
}

/** Final return type — core's gated result + our siglens-side gate errors. */
export type SubmitAnalysisActionResult =
    | SubmitAnalysisGatedResult
    | AnalysisGateBlockedResult;

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

    // No model selected → preserve previous behavior (core picks a default).
    if (modelId === undefined) {
        return submitAnalysis(
            symbol,
            companyName,
            timeframe,
            force,
            fmpSymbol,
            { waitUntil, modelId }
        );
    }

    const gate = await resolveTierAndByok(userId, modelId);
    if (gate.kind === 'blocked') {
        return { status: 'error', error: gate.error };
    }

    return submitAnalysis(symbol, companyName, timeframe, force, fmpSymbol, {
        waitUntil,
        modelId,
        tierContext: { userId, tier: gate.tier },
        ...(gate.userApiKey !== undefined ? { userApiKey: gate.userApiKey } : {}),
    });
}
