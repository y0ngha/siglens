'use server';

import { headers, cookies } from 'next/headers';
import {
    submitFinancialsAnalysis,
    type SubmitFinancialsAnalysisOptions,
    type SubmitFinancialsAnalysisResult,
} from '@y0ngha/siglens-core';
import { getFinancialStatementsProvider } from '@/shared/api/fmp/getFinancialStatementsProvider';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import {
    resolveTierAndByok,
    resolveReasoning,
    buildGateError,
} from '@/shared/lib/byokGate';
import { isBot } from '@/shared/api/isBot';
import { isE2E } from '@/shared/api/e2eEnv';
import type { AnalysisGateBlockedResult } from '@/shared/lib/types';

/** Final return type — core's financials result + our siglens-side gate errors. */
export type SubmitFinancialsAnalysisActionResult =
    | SubmitFinancialsAnalysisResult
    | AnalysisGateBlockedResult;

/** Server Action: tier + BYOK gate, then submit financials analysis via siglens-core with financial statements provider; returns `cached | submitted | error`. */
export async function submitFinancialsAnalysisAction(
    symbol: string,
    modelId: SubmitFinancialsAnalysisOptions['modelId'],
    /**
     * Client-requested "깊은 생각" (deep-thinking) toggle value (member-reasoning-toggle
     * spec Part A). Only honored for member/pro tiers.
     */
    reasoning?: boolean
): Promise<SubmitFinancialsAnalysisActionResult> {
    try {
        // E2E short-circuits the LLM/worker; returns a deterministic cached fixture
        // (see e2eAnalysisStub). The stub + JSON fixture load via a DYNAMIC import
        // under the inline E2E guard so they sit in a lazy chunk (not the prod main
        // bundle) and the branch stays resolvable by the vitest runner. Lives inside
        // try so a load failure can't propagate to the client (mirrors
        // submitAnalysisAction).
        if (isE2E()) {
            const stub = await import('@/shared/api/e2eAnalysisStub');
            // resilience 스펙이 설정하는 force-error 쿠키가 있으면 일시적 실패를
            // 결정적으로 주입해 에러 바운더리 → 재시도 → 복구를 검증할 수 있게 한다.
            const forceError = (await cookies()).get(
                stub.E2E_FORCE_FINANCIALS_ERROR_COOKIE
            );
            return forceError
                ? stub.e2eForcedFinancialsError()
                : stub.e2eCachedFinancials();
        }
        const requestHeaders = await headers();
        const skipEnqueueIfMiss = isBot(requestHeaders);

        const user = await getCurrentUser();
        const userId = user?.id ?? null;

        const gate = await resolveTierAndByok(userId, modelId);
        if (gate.kind === 'blocked') {
            return { status: 'error', error: gate.error };
        }

        return await submitFinancialsAnalysis({
            symbol,
            modelId,
            dataProvider: getFinancialStatementsProvider(),
            tier: gate.tier,
            reasoning: resolveReasoning(gate.tier, reasoning),
            skipEnqueueIfMiss,
            ...(gate.userApiKey !== undefined
                ? { userApiKey: gate.userApiKey }
                : {}),
        });
    } catch (err) {
        console.error(
            '[submitFinancialsAnalysisAction] unexpected error:',
            err
        );
        return { status: 'error', error: buildGateError('unexpected_error') };
    }
}
