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
    buildGateError,
    type AnalysisGateBlockedResult,
} from '@/infrastructure/market/byokGate';

// Re-export for consumers
export type { AnalysisGateBlockedResult };

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
    try {
        const user = await getCurrentUser();
        const userId = user?.id ?? null;

        // No model selected → preserve previous behavior (core picks a default).
        if (modelId === undefined) {
            return await submitAnalysis(
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

        return await submitAnalysis(
            symbol,
            companyName,
            timeframe,
            force,
            fmpSymbol,
            {
                waitUntil,
                modelId,
                tierContext: { userId, tier: gate.tier },
                ...(gate.userApiKey !== undefined
                    ? { userApiKey: gate.userApiKey }
                    : {}),
            }
        );
    } catch {
        return { status: 'error', error: buildGateError('unexpected_error') };
    }
}
