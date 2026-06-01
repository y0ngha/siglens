'use server';

import { waitUntil } from '@vercel/functions';
import { headers } from 'next/headers';
import {
    submitFundamentalAnalysis,
    type SubmitFundamentalAnalysisOptions,
    type SubmitFundamentalAnalysisResult,
} from '@y0ngha/siglens-core';
import { getFundamentalDataProvider } from '@/shared/api/fmp/getFundamentalDataProvider';
import { getCurrentUser } from '@/entities/session/lib/getCurrentUser';
import { resolveTierAndByok, buildGateError } from '@/shared/lib/byokGate';
import { isBot } from '@/shared/api/isBot';
import { isE2E } from '@/shared/api/e2eEnv';
import type { AnalysisGateBlockedResult } from '@/shared/lib/types';

/** Final return type — core's fundamental result + our siglens-side gate errors. */
export type SubmitFundamentalAnalysisActionResult =
    | SubmitFundamentalAnalysisResult
    | AnalysisGateBlockedResult;

/** Server Action: tier + BYOK gate, then submit fundamental analysis via siglens-core with FMP provider; returns `cached | submitted | error`. */
export async function submitFundamentalAnalysisAction(
    symbol: string,
    modelId: SubmitFundamentalAnalysisOptions['modelId']
): Promise<SubmitFundamentalAnalysisActionResult> {
    try {
        // E2E short-circuits the LLM/worker; returns a deterministic cached fixture
        // (see e2eAnalysisStub). The stub + JSON fixture load via a DYNAMIC import
        // under the inline E2E guard so they sit in a lazy chunk (not the prod main
        // bundle) and the branch stays resolvable by the vitest runner. Lives inside
        // try so a load failure can't propagate to the client (mirrors
        // submitAnalysisAction).
        if (isE2E()) {
            const { e2eCachedFundamental } =
                await import('@/shared/api/e2eAnalysisStub');
            return e2eCachedFundamental();
        }
        const requestHeaders = await headers();
        const skipEnqueueIfMiss = isBot(requestHeaders);

        const user = await getCurrentUser();
        const userId = user?.id ?? null;

        const gate = await resolveTierAndByok(userId, modelId);
        if (gate.kind === 'blocked') {
            return { status: 'error', error: gate.error };
        }

        return await submitFundamentalAnalysis({
            symbol,
            modelId,
            dataProvider: getFundamentalDataProvider(),
            waitUntil,
            tier: gate.tier,
            skipEnqueueIfMiss,
            ...(gate.userApiKey !== undefined
                ? { userApiKey: gate.userApiKey }
                : {}),
        });
    } catch (err) {
        console.error(
            '[submitFundamentalAnalysisAction] unexpected error:',
            err
        );
        return { status: 'error', error: buildGateError('unexpected_error') };
    }
}
