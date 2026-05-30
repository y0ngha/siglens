'use server';

import { waitUntil } from '@vercel/functions';
import { headers } from 'next/headers';
import {
    submitFundamentalAnalysis,
    type SubmitFundamentalAnalysisOptions,
    type SubmitFundamentalAnalysisResult,
} from '@y0ngha/siglens-core';
import { FmpFundamentalClient } from '@/shared/api/fmp/fundamentalClient';
import { getCurrentUser } from '@/entities/session/lib/getCurrentUser';
import { resolveTierAndByok, buildGateError } from '@/shared/lib/byokGate';
import { isBot } from '@/shared/api/isBot';
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
        // (see e2eAnalysisStub). The stub + JSON fixture are require'd (not statically
        // imported) under the inline E2E guard so they stay out of the production
        // bundle (matches getMarketDataProvider). Lives inside try so a require()
        // throw can't propagate to the client (mirrors submitAnalysisAction).
        if (process.env.E2E_TEST === '1') {
            const { e2eCachedFundamental } =
                require('@/shared/api/e2eAnalysisStub') as typeof import('@/shared/api/e2eAnalysisStub');
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
            dataProvider: new FmpFundamentalClient(),
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
