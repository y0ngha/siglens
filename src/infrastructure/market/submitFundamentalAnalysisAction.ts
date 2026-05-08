'use server';

import { waitUntil } from '@vercel/functions';
import {
    submitFundamentalAnalysis,
    type SubmitFundamentalAnalysisOptions,
    type SubmitFundamentalAnalysisResult,
} from '@y0ngha/siglens-core';
import { FmpFundamentalClient } from '@/infrastructure/fmp/fundamentalClient';
import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';
import {
    resolveTierAndByok,
    type AnalysisGateError,
} from '@/infrastructure/market/byokGate';

/** Gate denial result mirroring core's `{ status: 'error' }` discriminator. */
export interface AnalysisGateBlockedResult {
    status: 'error';
    error: AnalysisGateError;
}

/** Final return type — core's fundamental result + our siglens-side gate errors. */
export type SubmitFundamentalAnalysisActionResult =
    | SubmitFundamentalAnalysisResult
    | AnalysisGateBlockedResult;

/** Server Action: tier + BYOK gate, then submit fundamental analysis via siglens-core with FMP provider; returns `cached | submitted | error`. */
export async function submitFundamentalAnalysisAction(
    symbol: string,
    modelId: SubmitFundamentalAnalysisOptions['modelId']
): Promise<SubmitFundamentalAnalysisActionResult> {
    const user = await getCurrentUser();
    const userId = user?.id ?? null;

    const gate = await resolveTierAndByok(userId, modelId);
    if (gate.kind === 'blocked') {
        return { status: 'error', error: gate.error };
    }

    return submitFundamentalAnalysis({
        symbol,
        modelId,
        dataProvider: new FmpFundamentalClient(),
        waitUntil,
        tier: gate.tier,
        ...(gate.userApiKey !== undefined ? { userApiKey: gate.userApiKey } : {}),
    });
}
