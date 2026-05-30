'use server';

import { waitUntil } from '@vercel/functions';
import { headers, cookies } from 'next/headers';
import {
    submitOptionsAnalysis,
    pollOptionsAnalysis,
    cancelJob,
    type SubmitOptionsAnalysisResult,
    type PollOptionsAnalysisResult,
    type ModelId,
} from '@y0ngha/siglens-core';
import { fetchOptionsSnapshot } from '../lib/optionsDataCache';
import { getCurrentUser } from '@/entities/session/lib/getCurrentUser';
import { resolveTierAndByok, buildGateError } from '@/shared/lib/byokGate';
import { isBot } from '@/shared/api/isBot';
import type {
    AnalysisGateBlockedResult,
    OptionsExpirationSelector,
} from '@/shared/lib/types';

/** Final return type — core's options result + our siglens-side gate errors. */
export type SubmitOptionsAnalysisActionResult =
    | SubmitOptionsAnalysisResult
    | AnalysisGateBlockedResult;

/**
 * Server Action: tier + BYOK gate, then submit options analysis via siglens-core
 * with the Yahoo snapshot pre-fetched. Returns `cached | submitted | miss_no_trigger
 * | error` variants from siglens-core, or a gate-blocked error from siglens.
 */
export async function submitOptionsAnalysisAction(
    symbol: string,
    companyName: string,
    expirationDate: OptionsExpirationSelector,
    modelId: ModelId
): Promise<SubmitOptionsAnalysisActionResult> {
    try {
        // E2E short-circuits the LLM/worker with a deterministic fixture (see
        // e2eAnalysisStub). Loaded via a DYNAMIC import under the inline E2E guard
        // so the stub + JSON fixture sit in a lazy chunk (never in the prod main
        // bundle; the branch is dead when E2E_TEST is unset). Dynamic import (vs a
        // bare require) is also resolvable by the vitest runner, so this branch is
        // unit-tested. Inside try so a load failure can't propagate to the client.
        if (process.env.E2E_TEST === '1') {
            const stub = await import('@/shared/api/e2eAnalysisStub');
            // resilience 스펙이 설정하는 force-error 쿠키가 있으면 일시적 실패를
            // 결정적으로 주입해 에러 바운더리 → 재시도 → 복구를 검증할 수 있게 한다.
            const forceError = (await cookies()).get(
                stub.E2E_FORCE_ANALYSIS_ERROR_COOKIE
            );
            return forceError
                ? stub.e2eForcedOptionsError()
                : stub.e2eCachedOptions();
        }
        const requestHeaders = await headers();
        const skipEnqueueIfMiss = isBot(requestHeaders);

        const user = await getCurrentUser();
        const userId = user?.id ?? null;

        const gate = await resolveTierAndByok(userId, modelId);
        if (gate.kind === 'blocked') {
            return { status: 'error', error: gate.error };
        }

        const snapshot = await fetchOptionsSnapshot(symbol);
        if (snapshot === null) {
            return {
                status: 'no_chains_error',
                code: 'no_options_chains',
                error: '옵션 데이터를 가져올 수 없어요.',
            };
        }

        return await submitOptionsAnalysis({
            symbol,
            companyName,
            expirationDate,
            modelId,
            snapshot,
            waitUntil,
            tier: gate.tier,
            skipEnqueueIfMiss,
            ...(gate.userApiKey !== undefined
                ? { userApiKey: gate.userApiKey }
                : {}),
        });
    } catch (err) {
        console.error('[submitOptionsAnalysisAction] unexpected error:', err);
        return { status: 'error', error: buildGateError('unexpected_error') };
    }
}

/**
 * Server Action: poll a previously submitted options analysis job.
 * Returns `processing`, `done`, or `error`.
 */
export async function pollOptionsAnalysisAction(
    jobId: string
): Promise<PollOptionsAnalysisResult> {
    try {
        return await pollOptionsAnalysis(jobId);
    } catch (error) {
        console.error('[pollOptionsAnalysisAction] poll failed:', jobId, error);
        return { status: 'error', error: 'unexpected_error' };
    }
}

/**
 * Server Action: best-effort cancel for a running options analysis job.
 * Uses the generic queue cancelJob since siglens-core does not expose a
 * dedicated cancelOptionsAnalysisJob helper. Errors are swallowed.
 */
export async function cancelOptionsAnalysisJobAction(
    jobId: string
): Promise<void> {
    try {
        return await cancelJob(jobId);
    } catch (error) {
        console.warn(
            '[cancelOptionsAnalysisJobAction] 취소 신호 전송 실패:',
            jobId,
            error
        );
    }
}
