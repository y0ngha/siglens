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
} from '@/infrastructure/market/byokGate';
import type { AnalysisGateBlockedResult } from '@/domain/types';

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
        // No model selected → preserve previous behavior; no user lookup needed.
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

        const user = await getCurrentUser();
        const userId = user?.id ?? null;

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
    } catch (err) {
        console.error('[submitAnalysisAction] unexpected error:', err);
        return { status: 'error', error: buildGateError('unexpected_error') };
    }
}
