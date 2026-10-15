'use server';

import type { Locale } from '@/shared/i18n/locales';
import {
    type SubmitOverallAnalysisOptions,
    type RunOverallAnalysisResult,
    type Timeframe,
} from '@y0ngha/siglens-core';
import {
    executeOverallAnalysis,
    type SubmitOverallAnalysisActionOptions,
} from '@/entities/analysis/server/overallAnalysisRunner';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { resolveTierAndByok, buildGateError } from '@/shared/lib/byokGate';
import { caughtAnalysisErrorCode } from '@/shared/lib/aiProviderFailure';
import { isE2E } from '@/shared/api/e2eEnv';
import type { AnalysisGateBlockedResult } from '@/shared/lib/types';

/** Final return type — core's overall result + our siglens-side gate errors. */
export type RunOverallAnalysisActionResult =
    | RunOverallAnalysisResult
    | AnalysisGateBlockedResult;

/** Server Action: tier + BYOK gate, then submit a 4-axis overall analysis job; loads enriched news + earnings from DB, options snapshot, injects FMP provider; returns `cached | done | error`. */
export async function runOverallAnalysisAction(
    symbol: string,
    companyName: string,
    timeframe: Timeframe,
    modelId: SubmitOverallAnalysisOptions['modelId'],
    /**
     * 요청 로케일. 게이트 거부 문구가 사용자에게 그대로 보이는데 `/api/*`는
     * next-intl matcher 밖이라 액션이 스스로 알 수 없다. **기본값을 두지 않는다**
     * — 두면 호출부에서 빠져도 타입체커가 못 잡는다.
     */
    locale: Locale,
    options: SubmitOverallAnalysisActionOptions = {},
    signal?: AbortSignal
): Promise<RunOverallAnalysisActionResult> {
    try {
        // E2E short-circuits the LLM/worker; returns a deterministic cached fixture
        // (see e2eAnalysisStub). The stub + JSON fixture load via a DYNAMIC import
        // under the inline E2E guard so they sit in a lazy chunk (not the prod main
        // bundle) and the branch stays resolvable by the vitest runner. Lives inside
        // try so a load failure can't propagate to the client (mirrors
        // SSE 분석 라우트의 technical 분기).
        if (isE2E()) {
            const { e2eCachedOverall } =
                await import('@/shared/api/e2eAnalysisStub');
            return e2eCachedOverall();
        }
        const user = await getCurrentUser();
        const userId = user?.id ?? null;

        const gate = await resolveTierAndByok(userId, modelId, locale);
        if (gate.kind === 'blocked') {
            return { status: 'error', error: gate.error };
        }

        return await executeOverallAnalysis({
            caller: {
                userId,
                tier: gate.tier,
                ...(gate.userApiKey !== undefined
                    ? { userApiKey: gate.userApiKey }
                    : {}),
            },
            symbol,
            companyName,
            timeframe,
            modelId,
            locale,
            options,
            signal,
        });
    } catch (err) {
        console.error('[runOverallAnalysisAction] unexpected error:', err);
        return {
            status: 'error',
            error: await buildGateError(caughtAnalysisErrorCode(err), locale),
        };
    }
}
